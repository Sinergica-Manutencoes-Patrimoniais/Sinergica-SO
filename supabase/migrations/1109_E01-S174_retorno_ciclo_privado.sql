-- ADR-0960: transição experimental privada; não integrar ou habilitar sem protocolo completo.
create table pcm.sso_retorno_ciclo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_retorno_ciclo_gate(id,habilitado) values(true,false);
create table pcm.sso_retornos_ciclo_backlog(
  id uuid primary key, ciclo_id uuid not null unique references pcm.sso_ciclos_backlog(id),
  cliente_id uuid not null references pcm.clientes(id),pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),
  chamado_id uuid not null references pcm.chamados(id),parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),
  os_id uuid not null references pcm.ordens_servico(id),reconciliacao_id uuid not null references pcm.sso_reconciliacoes_parcela(id),
  suspensao_revision integer not null check(suspensao_revision>0),interrupcao_revision integer not null check(interrupcao_revision>0),
  estado text not null check(estado in ('aguardando','promovido')),revisao integer not null default 1 check(revisao>0),
  criado_em timestamptz not null default now()
);
create unique index sso_retornos_ciclo_um_aguardando on pcm.sso_retornos_ciclo_backlog(pendencia_id) where estado='aguardando';
alter table pcm.sso_retorno_ciclo_gate enable row level security;alter table pcm.sso_retorno_ciclo_gate force row level security;
alter table pcm.sso_retornos_ciclo_backlog enable row level security;alter table pcm.sso_retornos_ciclo_backlog force row level security;
revoke all on pcm.sso_retorno_ciclo_gate,pcm.sso_retornos_ciclo_backlog from public,anon,authenticated,service_role;

create function pcm.sso_devolver_ciclo_backlog(p_request_id uuid,p_cliente_id uuid,p_ciclo_id uuid,p_retorno_id uuid,
  p_ciclo_revision integer,p_suspensao_revision integer,p_interrupcao_revision integer,p_reconciliacao_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_payload jsonb;v_evento pcm.sso_ciclos_backlog_eventos%rowtype;
  v_ciclo pcm.sso_ciclos_backlog%rowtype;v_chamado pcm.chamados%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;
  v_suspensao pcm.sso_suspensoes_chamado%rowtype;v_atribuicao pcm.sso_atribuicoes_parcela%rowtype;
  v_interrupcao pcm.sso_interrupcoes_parcela%rowtype;v_reconciliacao pcm.sso_reconciliacoes_parcela%rowtype;v_os pcm.ordens_servico%rowtype;
begin
  perform 1 from pcm.sso_retorno_ciclo_gate where id and habilitado for share;
  if not found then raise exception 'retorno_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_ciclo_id is null or p_retorno_id is null
    or p_ciclo_revision is null or p_ciclo_revision<1 or p_suspensao_revision is null or p_suspensao_revision<1
    or p_interrupcao_revision is null or p_interrupcao_revision<1 or p_reconciliacao_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'cicloId',p_ciclo_id,'retornoId',p_retorno_id,'cicloRevision',p_ciclo_revision,
    'suspensaoRevision',p_suspensao_revision,'interrupcaoRevision',p_interrupcao_revision,'reconciliacaoId',p_reconciliacao_id,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciclo-backlog:'||p_request_id::text,0));
  select * into v_evento from pcm.sso_ciclos_backlog_eventos where request_id=p_request_id;
  if found then
    if v_evento.ator_id is distinct from v_ator or v_evento.tipo<>'devolvido' or v_evento.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'cicloId',p_ciclo_id,'retornoId',p_retorno_id,'revision',v_evento.revisao,'estado','aguardando');
  end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id;
  if not found then raise exception 'ciclo_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  select * into v_suspensao from pcm.sso_suspensoes_chamado where chamado_id=v_chamado.id and cliente_id=p_cliente_id for update;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and chamado_id=v_chamado.id for update;
  if v_ciclo.id is null or v_ciclo.estado<>'em_tratamento' or v_ciclo.revisao<>p_ciclo_revision
    or v_suspensao.estado is distinct from 'suspenso' or v_suspensao.revisao is distinct from p_suspensao_revision then raise exception 'ciclo_ou_suspensao_alterada' using errcode='40001'; end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=v_ciclo.parcela_id and chamado_id=v_chamado.id for update;
  select * into v_atribuicao from pcm.sso_atribuicoes_parcela where parcela_id=v_ciclo.parcela_id and chamado_id=v_chamado.id and cliente_id=p_cliente_id for update;
  if v_parcela.id is null or v_parcela.situacao<>'pendente' or v_atribuicao.parcela_id is null then raise exception 'escopo_indisponivel' using errcode='23514'; end if;
  select * into v_os from pcm.ordens_servico where id=v_atribuicao.os_id and chamado_id=v_chamado.id and client_id=p_cliente_id and deleted_at is null for update;
  select * into v_interrupcao from pcm.sso_interrupcoes_parcela where parcela_id=v_parcela.id and os_id=v_atribuicao.os_id and chamado_id=v_chamado.id and cliente_id=p_cliente_id for update;
  select * into v_reconciliacao from pcm.sso_reconciliacoes_parcela where parcela_id=v_parcela.id and cliente_id=p_cliente_id order by revisao desc limit 1;
  if v_os.id is null or v_os.status is null or v_os.status not in ('finalizado','cancelado') or v_interrupcao.estado is distinct from 'declarada'
    or v_interrupcao.revisao is distinct from p_interrupcao_revision or v_reconciliacao.id is distinct from p_reconciliacao_id
    or v_reconciliacao.os_id is distinct from v_os.id or v_reconciliacao.estado is distinct from 'nao_executada_declarada'
    or v_reconciliacao.suspensao_revision is distinct from p_suspensao_revision or v_reconciliacao.interrupcao_revision is distinct from p_interrupcao_revision then
    raise exception 'reconciliacao_incompativel' using errcode='23514'; end if;
  if not exists(select 1 from pcm.sso_pendencias_tecnicas where id=v_ciclo.pendencia_id and cliente_id=p_cliente_id and estado='aberta') then raise exception 'pendencia_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  update pcm.sso_ciclos_backlog set estado='devolvido',revisao=revisao+1 where id=p_ciclo_id;
  insert into pcm.sso_retornos_ciclo_backlog(id,ciclo_id,cliente_id,pendencia_id,chamado_id,parcela_id,os_id,reconciliacao_id,suspensao_revision,interrupcao_revision,estado)
    values(p_retorno_id,p_ciclo_id,p_cliente_id,v_ciclo.pendencia_id,v_chamado.id,v_parcela.id,v_os.id,v_reconciliacao.id,p_suspensao_revision,p_interrupcao_revision,'aguardando');
  insert into pcm.sso_ciclos_backlog_eventos(ciclo_id,revisao,tipo,ator_id,request_id,payload) values(p_ciclo_id,p_ciclo_revision+1,'devolvido',v_ator,p_request_id,v_payload);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.ciclo_devolvido','sso_ciclos_backlog',p_ciclo_id,v_payload||jsonb_build_object('requestId',p_request_id));
  return jsonb_build_object('requestId',p_request_id,'cicloId',p_ciclo_id,'retornoId',p_retorno_id,'revision',p_ciclo_revision+1,'estado','aguardando');
end; $$;
revoke all on function pcm.sso_devolver_ciclo_backlog(uuid,uuid,uuid,uuid,integer,integer,integer,uuid,text) from public,anon,authenticated,service_role;
