-- ADR-0536: delega à alocação canônica; sem efeito externo.
create function financeiro.sso_alocar_parcela_adicional(p_request_id uuid,p_alocacao_id uuid,p_cliente_id uuid,p_item_id uuid,p_expected_revision integer,p_documento_id uuid,p_valor_centavos bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_faturavel_documentos%rowtype; i financeiro.itens_faturaveis%rowtype;
begin
  if not coalesce((select habilitado from financeiro.sso_parcela_adicional_gate where id),false) or not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_alocacao_id is null or p_cliente_id is null or p_item_id is null or p_expected_revision is null or p_expected_revision<1
    or p_documento_id is null or p_valor_centavos is null or p_valor_centavos not between 1 and 9007199254740991 or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faturavel:'||p_request_id::text,0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into d from financeiro.sso_faturavel_documentos where id=p_documento_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from financeiro.lancamentos where id=d.lancamento_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento:'||p_cliente_id::text||':'||btrim(d.referencia),0));
  perform 1 from financeiro.sso_faturavel_documentos where id=d.id and cliente_id=p_cliente_id and lancamento_id=d.lancamento_id and referencia=d.referencia and data_documento=d.data_documento for update;
  if not found then raise exception 'documento_alterado' using errcode='40001'; end if;
  if not exists(select 1 from financeiro.sso_faturavel_alocacoes where item_id=i.id and documento_id=d.id) then raise exception 'primeira_parcela_ausente' using errcode='23514'; end if;
  return financeiro.sso_alocar_faturavel_documento(p_request_id,p_alocacao_id,p_item_id,p_expected_revision,d.lancamento_id,d.referencia,d.data_documento,p_valor_centavos);
end $$;
revoke all on function financeiro.sso_alocar_parcela_adicional(uuid,uuid,uuid,uuid,integer,uuid,bigint) from public,anon,authenticated,service_role;
