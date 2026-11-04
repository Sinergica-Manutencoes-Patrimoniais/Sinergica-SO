-- ADR-0213: declaração humana; nunca afirma conciliação remota.
alter table pcm.reprogramacao_os_intencoes add column revisao integer not null default 1 check(revisao>0);
create table pcm.reprogramacao_os_intencao_eventos (
  id uuid primary key,intencao_id uuid not null references pcm.reprogramacao_os_intencoes(id),revisao integer not null,
  acao text not null check(acao in ('anotar','descartar')),resultado_declarado text check(resultado_declarado in ('mesma_tarefa','divergente','desconhecido')),
  tarefa_declarada text,referencia text,motivo text not null check(length(btrim(motivo)) between 1 and 2000),
  ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),
  unique(intencao_id,revisao)
);
alter table pcm.reprogramacao_os_intencao_eventos enable row level security;
alter table pcm.reprogramacao_os_intencao_eventos force row level security;
revoke all on pcm.reprogramacao_os_intencao_eventos from public,anon,authenticated,service_role;
create function pcm.sso_proteger_evento_intencao_os() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'evento_intencao_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_evento_intencao_os() from public,anon,authenticated,service_role;
create trigger reprogramacao_intencao_evento_imutavel before update or delete on pcm.reprogramacao_os_intencao_eventos
  for each row execute function pcm.sso_proteger_evento_intencao_os();

create function pcm.sso_triagem_intencao_os(p_request_id uuid,p_evento_id uuid,p_intencao_id uuid,p_expected_revision integer,
  p_acao text,p_resultado text,p_tarefa text,p_referencia text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_intencao pcm.reprogramacao_os_intencoes%rowtype;v_evento pcm.reprogramacao_os_intencao_eventos%rowtype;
begin
  if not coalesce((select habilitado from pcm.reprogramacao_os_enviada_gate where id),false) then raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_evento_id is null or p_intencao_id is null or p_expected_revision is null or p_expected_revision<1
    or p_acao is null or p_acao not in ('anotar','descartar') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or (p_acao='anotar' and (p_resultado is null or p_resultado not in ('mesma_tarefa','divergente','desconhecido')
      or p_referencia is null or length(btrim(p_referencia)) not between 1 and 500))
    or (p_acao='descartar' and (p_resultado is not null or p_tarefa is not null or p_referencia is not null)) then
    raise exception 'triagem_invalida' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('intencao-os-triagem:'||p_request_id::text,0));
  select * into v_evento from pcm.reprogramacao_os_intencao_eventos where request_id=p_request_id;
  select * into v_intencao from pcm.reprogramacao_os_intencoes where id=p_intencao_id for update;
  if not found or config.sso_autorizar_acao('visita.confirmar',v_intencao.cliente_id) is distinct from true
    or config.sso_autorizar_acao('integracao.reconciliar',v_intencao.cliente_id) is distinct from true then
    raise exception 'intencao_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if v_evento.request_id is not null then
    if v_evento.ator_id is distinct from v_actor or v_evento.id is distinct from p_evento_id or v_evento.intencao_id is distinct from p_intencao_id
      or v_evento.revisao is distinct from p_expected_revision+1 or v_evento.acao is distinct from p_acao
      or v_evento.resultado_declarado is distinct from p_resultado or v_evento.tarefa_declarada is distinct from p_tarefa
      or v_evento.referencia is distinct from p_referencia or v_evento.motivo is distinct from btrim(p_motivo) then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'intencaoId',p_intencao_id,'revision',v_evento.revisao,'efeitoRemoto',false);
  end if;
  if v_intencao.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_intencao.estado<>'pendente' then raise exception 'intencao_nao_pendente' using errcode='23514'; end if;
  if p_resultado='mesma_tarefa' and p_tarefa is distinct from v_intencao.tarefa_auvo_id::text then raise exception 'identidade_divergente' using errcode='23514'; end if;
  if length(coalesce(p_tarefa,''))>100 or length(coalesce(p_referencia,''))>500 then raise exception 'triagem_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('visita.confirmar',v_intencao.cliente_id) is distinct from true
    or config.sso_autorizar_acao('integracao.reconciliar',v_intencao.cliente_id) is distinct from true then raise exception 'intencao_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  update pcm.reprogramacao_os_intencoes set revisao=revisao+1,estado=case when p_acao='descartar' then 'descartada' else estado end
    where id=p_intencao_id returning * into v_intencao;
  insert into pcm.reprogramacao_os_intencao_eventos(id,intencao_id,revisao,acao,resultado_declarado,tarefa_declarada,referencia,motivo,ator_id,request_id)
    values(p_evento_id,p_intencao_id,v_intencao.revisao,p_acao,p_resultado,p_tarefa,p_referencia,btrim(p_motivo),v_actor,p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'visita.intencao_triagem','reprogramacao_os_intencoes',p_intencao_id,
    jsonb_build_object('requestId',p_request_id,'revision',v_intencao.revisao,'acao',p_acao));
  return jsonb_build_object('requestId',p_request_id,'intencaoId',p_intencao_id,'revision',v_intencao.revisao,'efeitoRemoto',false);
end;
$$;
revoke all on function pcm.sso_triagem_intencao_os(uuid,uuid,uuid,integer,text,text,text,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_intencoes_os_triagem(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,os_id uuid,visita_origem_id uuid,visita_destino_id uuid,tarefa_auvo_id text,estado text,revisao integer,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reprogramacao_os_enviada_gate where id),false) then raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select i.id,i.os_id,i.visita_origem_id,i.visita_destino_id,i.tarefa_auvo_id::text,i.estado,i.revisao,i.criado_em
    from pcm.reprogramacao_os_intencoes i join pcm.ordens_servico os on os.id=i.os_id and os.client_id=i.cliente_id and os.deleted_at is null
    where i.cliente_id=p_cliente_id and (p_apos is null or i.id>p_apos) order by i.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_intencoes_os_triagem(uuid,uuid,integer) from public,anon,authenticated,service_role;
