-- ADR-0190: preparação fechada; sem manipular ocorrências ou OS.
create table pcm.plano_transicao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.plano_transicao_gate enable row level security;
alter table pcm.plano_transicao_gate force row level security;
revoke all on pcm.plano_transicao_gate from public,anon,authenticated,service_role;
insert into pcm.plano_transicao_gate(id,habilitado) values(true,false);
create table pcm.plano_transicoes_historico (
  id uuid primary key default gen_random_uuid(),plano_id uuid not null references pcm.planos_manutencao(id),
  revisao integer not null,acao text not null check(acao in ('suspender','encerrar')),
  estado_anterior text not null,estado_novo text not null,vigencia date not null,
  motivo text not null check(length(btrim(motivo)) between 1 and 2000),
  request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  unique(plano_id,revisao)
);
alter table pcm.plano_transicoes_historico enable row level security;
alter table pcm.plano_transicoes_historico force row level security;
revoke all on pcm.plano_transicoes_historico from public,anon,authenticated,service_role;
create function pcm.sso_proteger_transicao_plano() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'transicao_plano_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_transicao_plano() from public,anon,authenticated,service_role;
create trigger plano_transicao_imutavel before update or delete on pcm.plano_transicoes_historico
  for each row execute function pcm.sso_proteger_transicao_plano();

create function pcm.sso_transicionar_plano_preparado(p_request_id uuid,p_plano_id uuid,p_expected_revision integer,
  p_acao text,p_vigencia date,p_motivo text) returns jsonb language plpgsql security definer set search_path='' set timezone='America/Sao_Paulo' as $$
declare v_actor uuid:=auth.uid(); v_antes pcm.planos_manutencao%rowtype; v_depois pcm.planos_manutencao%rowtype;
  v_comando pcm.plano_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.plano_transicao_gate where id),false) then raise exception 'transicao_plano_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<1
    or p_acao is null or p_acao not in ('suspender','encerrar') or p_vigencia is null or not isfinite(p_vigencia)
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'transicao_invalida' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('tipo','transicionarPlanoPreparado','planoId',p_plano_id,'expectedRevision',p_expected_revision,
    'acao',p_acao,'vigencia',p_vigencia,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:'||p_request_id::text,0));
  select * into v_comando from pcm.plano_comandos where request_id=p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or config.sso_autorizar_acao('plano.gerir',v_comando.cliente_id) is distinct from true then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  select * into v_antes from pcm.planos_manutencao where id=p_plano_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir',v_antes.cliente_id) is distinct from true then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if v_antes.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_antes.estado not in ('aprovado','ativo') or p_vigencia<>current_date then
    raise exception 'transicao_exige_reconciliacao' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',v_antes.cliente_id) is distinct from true then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  update pcm.planos_manutencao set estado=case when p_acao='suspender' then 'suspenso' else 'encerrado' end,
    revisao=revisao+1,updated_at=now(),updated_by=v_actor where id=p_plano_id returning * into v_depois;
  insert into pcm.plano_transicoes_historico(plano_id,revisao,acao,estado_anterior,estado_novo,vigencia,motivo,request_id,ator_id)
    values(p_plano_id,v_depois.revisao,p_acao,v_antes.estado,v_depois.estado,p_vigencia,btrim(p_motivo),p_request_id,v_actor);
  v_resultado:=jsonb_build_object('aggregateId',p_plano_id,'revision',v_depois.revisao,'state',v_depois.estado,'created',false,
    'linkedIds',jsonb_build_object('clienteId',v_depois.cliente_id),'warnings',jsonb_build_array('geradores_legados_exigem_reconciliacao'),'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.'||p_acao,'planos_manutencao',p_plano_id,
    jsonb_build_object('requestId',p_request_id,'revision',v_depois.revisao,'vigencia',p_vigencia,'motivo',btrim(p_motivo)));
  insert into pcm.plano_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,v_depois.cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_transicionar_plano_preparado(uuid,uuid,integer,text,date,text) from public,anon,authenticated,service_role;
