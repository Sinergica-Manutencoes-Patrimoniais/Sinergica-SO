-- ADR-0183: transições locais com gate fechado; nunca excluir tarefa remota.
create table pcm.visita_transicao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.visita_transicao_gate enable row level security;
alter table pcm.visita_transicao_gate force row level security;
revoke all on pcm.visita_transicao_gate from public,anon,authenticated,service_role;
insert into pcm.visita_transicao_gate(id,habilitado) values(true,false);
create table pcm.visita_transicoes_historico (
  id uuid primary key default gen_random_uuid(), visita_id uuid not null references pcm.visitas(id),
  revisao integer not null, acao text not null check(acao in ('reprogramar','cancelar')),
  motivo text not null check(length(btrim(motivo)) between 1 and 2000),
  inicio_anterior timestamptz not null, fim_anterior timestamptz not null,
  inicio_novo timestamptz, fim_novo timestamptz, estado_anterior text not null, estado_novo text not null,
  request_id uuid not null unique, ator_id uuid not null references auth.users(id), criado_em timestamptz not null default now(),
  unique(visita_id,revisao)
);
alter table pcm.visita_transicoes_historico enable row level security;
alter table pcm.visita_transicoes_historico force row level security;
revoke all on pcm.visita_transicoes_historico from public,anon,authenticated,service_role;
create function pcm.sso_proteger_transicao_visita() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'transicao_visita_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_transicao_visita() from public,anon,authenticated,service_role;
create trigger visita_transicao_imutavel before update or delete on pcm.visita_transicoes_historico
  for each row execute function pcm.sso_proteger_transicao_visita();

create function pcm.sso_transicionar_visita_preparada(p_request_id uuid,p_visita_id uuid,p_expected_revision integer,
  p_acao text,p_inicio timestamptz,p_fim timestamptz,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_antes pcm.visitas%rowtype; v_depois pcm.visitas%rowtype;
  v_anterior pcm.visita_comandos%rowtype; v_payload jsonb; v_resultado jsonb; v_capacidade text;
begin
  if not coalesce((select habilitado from pcm.visita_transicao_gate where id),false) then raise exception 'transicao_visita_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_visita_id is null or p_expected_revision is null or p_expected_revision<1
    or p_acao is null or p_acao not in ('reprogramar','cancelar') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or (p_acao='reprogramar' and (p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<=p_inicio))
    or (p_acao='cancelar' and (p_inicio is not null or p_fim is not null)) then raise exception 'transicao_invalida' using errcode='22023'; end if;
  v_capacidade:=case p_acao when 'cancelar' then 'visita.cancelar' else 'visita.confirmar' end;
  v_payload:=jsonb_build_object('tipo','transicionarVisitaPreparada','visitaId',p_visita_id,'expectedRevision',p_expected_revision,
    'acao',p_acao,'inicio',p_inicio,'fim',p_fim,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  select * into v_anterior from pcm.visita_comandos where request_id=p_request_id;
  if found then
    if v_anterior.actor_id is distinct from v_actor or config.sso_autorizar_acao(v_capacidade,v_anterior.cliente_id) is distinct from true then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
    if v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_anterior.resultado;
  end if;
  select * into v_antes from pcm.visitas where id=p_visita_id for update;
  if not found or config.sso_autorizar_acao(v_capacidade,v_antes.cliente_id) is distinct from true then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if v_antes.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_antes.estado not in ('rascunho','planejada','confirmada') then raise exception 'estado_exige_reconciliacao' using errcode='23514'; end if;
  perform o.id from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id
    where vo.visita_id=p_visita_id and vo.encerrado_em is null order by o.id for share of o;
  if exists(select 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id
    where vo.visita_id=p_visita_id and vo.encerrado_em is null and (o.auvo_task_id is not null or o.auvo_sync_status is not null)) then
    raise exception 'efeito_remoto_exige_reconciliacao' using errcode='23514'; end if;
  if config.sso_autorizar_acao(v_capacidade,v_antes.cliente_id) is distinct from true then raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  update pcm.visitas set inicio_em=case when p_acao='reprogramar' then p_inicio else inicio_em end,
    fim_em=case when p_acao='reprogramar' then p_fim else fim_em end,
    estado=case when p_acao='cancelar' then 'cancelada' when v_antes.estado='rascunho' then 'rascunho' else 'planejada' end,
    revisao=revisao+1,updated_at=now(),updated_by=v_actor where id=p_visita_id returning * into v_depois;
  insert into pcm.visita_transicoes_historico(visita_id,revisao,acao,motivo,inicio_anterior,fim_anterior,inicio_novo,fim_novo,estado_anterior,estado_novo,request_id,ator_id)
    values(p_visita_id,v_depois.revisao,p_acao,btrim(p_motivo),v_antes.inicio_em,v_antes.fim_em,
      case when p_acao='reprogramar' then p_inicio end,case when p_acao='reprogramar' then p_fim end,
      v_antes.estado,v_depois.estado,p_request_id,v_actor);
  v_resultado:=jsonb_build_object('aggregateId',p_visita_id,'revision',v_depois.revisao,'state',v_depois.estado,'created',false,
    'linkedIds',jsonb_build_object('clienteId',v_depois.cliente_id),'warnings',jsonb_build_array('sem_acao_remota','vinculos_os_preservados'),'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'visita.'||p_acao,'visitas',p_visita_id,
    jsonb_build_object('requestId',p_request_id,'revision',v_depois.revisao,'motivo',btrim(p_motivo)));
  insert into pcm.visita_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,v_depois.cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_transicionar_visita_preparada(uuid,uuid,integer,text,timestamptz,timestamptz,text) from public,anon,authenticated,service_role;
