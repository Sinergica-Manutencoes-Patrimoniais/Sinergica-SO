-- ADR-1238: um aceite e um lote formam um vínculo imutável.
create table pcm.sso_aceites_execucoes_lote_legado(
  aceite_id uuid primary key references pcm.sso_aceites_lote_legado(request_id),
  lote_id uuid not null unique references pcm.sso_lotes_rascunhos_legados(request_id),
  ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  criado_em timestamptz not null default now()
);
alter table pcm.sso_aceites_execucoes_lote_legado enable row level security;
alter table pcm.sso_aceites_execucoes_lote_legado force row level security;
revoke all on pcm.sso_aceites_execucoes_lote_legado from public,anon,authenticated,service_role;
create trigger sso_aceites_execucoes_lote_imutaveis before update or delete on pcm.sso_aceites_execucoes_lote_legado
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

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
