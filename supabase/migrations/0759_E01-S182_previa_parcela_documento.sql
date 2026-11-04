-- ADR-0534: prévia não reserva saldo ou executa alocação.
create function financeiro.sso_previa_parcela_documento(p_cliente_id uuid,p_item_id uuid,p_lancamento_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; l financeiro.lancamentos%rowtype; d financeiro.sso_faturavel_documentos%rowtype; totais jsonb;
begin
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or p_lancamento_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id;
  select * into l from financeiro.lancamentos where id=p_lancamento_id and cliente_id=p_cliente_id and tipo='entrada';
  if i.id is null or l.id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into d from financeiro.sso_faturavel_documentos where lancamento_id=l.id and cliente_id=p_cliente_id;
  totais:=financeiro.sso_totais_alocacoes_ativas(i.id,d.id);
  return jsonb_build_object('itemId',i.id,'lancamentoId',l.id,'revisaoItem',i.revisao,'documento',case when d.id is null then null else
    jsonb_build_object('id',d.id,'referencia',d.referencia,'data',d.data_documento) end,'alocadoItemCentavos',totais->>'itemCentavos',
    'alocadoDocumentoCentavos',totais->>'documentoCentavos','parcelasAdicionaisHabilitadas',coalesce((select habilitado from financeiro.sso_parcela_adicional_gate where id),false),
    'reservaSaldo',false,'cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_previa_parcela_documento(uuid,uuid,uuid) from public,anon,authenticated,service_role;
