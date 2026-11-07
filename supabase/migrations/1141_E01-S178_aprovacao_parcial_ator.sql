-- ADR-0988: mediador privado; não concede execução ou abre gates.
create function pcm.sso_aprovar_linhas_ator(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_lote_id uuid,
  p_expected_revision integer,p_itens jsonb,p_motivo text,p_confirmado boolean) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_esperado or p_request_id is null or p_cliente_id is null or p_lote_id is null
    or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  -- A 1142 deve estar presente antes de abrir esta entrada; repetições recuperam o recibo original.
  if not exists(select 1 from pcm.sso_levantamento_comandos where request_id=p_request_id) then
    perform pcm.sso_exigir_hierarquia_parcial_aciclica(p_lote_id,p_itens);
  end if;
  return pcm.sso_aprovar_linhas_autorizado(p_request_id,p_lote_id,p_expected_revision,p_itens,p_motivo,p_confirmado);
end; $$;
revoke all on function pcm.sso_aprovar_linhas_ator(uuid,uuid,uuid,uuid,integer,jsonb,text,boolean) from public,anon,authenticated,service_role;
