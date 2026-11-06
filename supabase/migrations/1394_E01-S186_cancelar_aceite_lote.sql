-- ADR-1241: cancelamento imutável sem alterar o aceite ou Planos.
create table pcm.sso_cancelamento_aceite_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_cancelamento_aceite_lote_gate(id,habilitado) values(true,false);
create table pcm.sso_cancelamentos_aceite_lote(
  request_id uuid primary key,aceite_id uuid not null unique references pcm.sso_aceites_lote_legado(request_id),
  ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  motivo text not null check(length(btrim(motivo)) between 1 and 2000),resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_cancelamento_aceite_lote_gate enable row level security;
alter table pcm.sso_cancelamento_aceite_lote_gate force row level security;
alter table pcm.sso_cancelamentos_aceite_lote enable row level security;
alter table pcm.sso_cancelamentos_aceite_lote force row level security;
revoke all on pcm.sso_cancelamento_aceite_lote_gate,pcm.sso_cancelamentos_aceite_lote from public,anon,authenticated,service_role;
create trigger sso_cancelamentos_aceite_lote_imutaveis before update or delete on pcm.sso_cancelamentos_aceite_lote
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_cancelar_aceite_lote_legado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_aceite_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_cancelamentos_aceite_lote%rowtype;v_motivo text:=nullif(btrim(p_motivo),'');v_resultado jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_aceite_id is null
    or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_cancelamento_aceite_lote_gate where id and habilitado for share;
  if not found then raise exception 'cancelamento_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_aceite_lote_legado_gate where id and habilitado for share;
  if not found then raise exception 'aceite_desabilitado' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cancelamento-aceite-request:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_cancelamentos_aceite_lote where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.aceite_id is distinct from p_aceite_id or v_ant.motivo is distinct from v_motivo then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('aceite-lote-legado:'||p_aceite_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('execucao-aceite-lote:'||p_aceite_id::text,0));
  if not exists(select 1 from pcm.sso_aceites_lote_legado where request_id=p_aceite_id and ator_id=p_ator_id and cliente_id=p_cliente_id) then raise exception 'aceite_indisponivel' using errcode='42501'; end if;
  if exists(select 1 from pcm.sso_aceites_execucoes_lote_legado where aceite_id=p_aceite_id) then raise exception 'aceite_ja_executado' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_cancelamentos_aceite_lote where aceite_id=p_aceite_id) then raise exception 'aceite_ja_cancelado' using errcode='23505'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'aceiteId',p_aceite_id,'estado','cancelado','loteRevertido',false);
  insert into pcm.sso_cancelamentos_aceite_lote(request_id,aceite_id,ator_id,cliente_id,motivo,resultado) values(p_request_id,p_aceite_id,p_ator_id,p_cliente_id,v_motivo,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'migracao.aceite_lote_cancelado','sso_aceites_lote_legado',p_aceite_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'motivo',v_motivo));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_cancelar_aceite_lote_legado(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
create or replace function pcm.sso_criar_lote_legado_aceito(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_aceite_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_aceite pcm.sso_aceites_lote_legado%rowtype;v_link pcm.sso_aceites_execucoes_lote_legado%rowtype;v_resultado jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_aceite_id is null
    or p_request_id=p_aceite_id then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_aceite_lote_legado_gate where id and habilitado for share;
  if not found then raise exception 'aceite_desabilitado' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_aceite from pcm.sso_aceites_lote_legado where request_id=p_aceite_id and ator_id=p_ator_id and cliente_id=p_cliente_id;
  if not found then raise exception 'aceite_indisponivel' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('execucao-aceite-lote:'||p_aceite_id::text,0));
  if exists(select 1 from pcm.sso_cancelamentos_aceite_lote where aceite_id=p_aceite_id) then raise exception 'aceite_cancelado' using errcode='23514'; end if;
  select * into v_link from pcm.sso_aceites_execucoes_lote_legado where aceite_id=p_aceite_id or lote_id=p_request_id;
  if found and (v_link.aceite_id is distinct from p_aceite_id or v_link.lote_id is distinct from p_request_id
    or v_link.ator_id is distinct from p_ator_id or v_link.cliente_id is distinct from p_cliente_id) then
    raise exception 'aceite_ou_lote_ja_utilizado' using errcode='23505'; end if;
  v_resultado:=pcm.sso_criar_lote_rascunhos_planos_legados(p_ator_id,p_cliente_id,p_request_id,v_aceite.itens);
  if v_resultado->>'requestId' is distinct from p_request_id::text or v_resultado->>'clienteId' is distinct from p_cliente_id::text then raise exception 'recibo_invalido' using errcode='23514'; end if;
  if v_link.aceite_id is null then
    insert into pcm.sso_aceites_execucoes_lote_legado(aceite_id,lote_id,ator_id,cliente_id) values(p_aceite_id,p_request_id,p_ator_id,p_cliente_id);
  end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_criar_lote_legado_aceito(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_criar_lote_legado_aceito(uuid,uuid,uuid,uuid) to authenticated;
