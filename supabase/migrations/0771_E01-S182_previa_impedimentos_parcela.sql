-- ADR-0546: diagnóstico atual não representa resultado de pedido anterior.
create function financeiro.sso_previa_impedimentos_parcela(p_cliente_id uuid,p_item_id uuid,p_documento_id uuid,p_revisao integer,p_valor_centavos bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; d financeiro.sso_faturavel_documentos%rowtype; l financeiro.lancamentos%rowtype; totais jsonb; motivos text[];
begin
  if not coalesce((select habilitado from financeiro.sso_recuperar_parcela_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or p_documento_id is null or p_revisao is null or p_revisao<1
    or p_valor_centavos is null or p_valor_centavos not between 1 and 9007199254740991 or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id;
  select * into d from financeiro.sso_faturavel_documentos where id=p_documento_id and cliente_id=p_cliente_id;
  if i.id is null or d.id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into l from financeiro.lancamentos where id=d.lancamento_id and cliente_id=p_cliente_id;
  if l.id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  totais:=financeiro.sso_totais_alocacoes_ativas(i.id,d.id);
  motivos:=array_remove(array[
    case when not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) or not coalesce((select habilitado from financeiro.sso_parcela_adicional_gate where id),false) then 'gate_fechado' end,
    case when i.revisao<>p_revisao then 'revisao_divergente' end,
    case when i.status not in ('conferido','parcial') or i.valor_conferido_centavos is null then 'item_nao_elegivel' end,
    case when l.tipo<>'entrada' or date_trunc('month',l.data_competencia)::date is distinct from i.competencia then 'lancamento_incompativel' end,
    case when exists(select 1 from financeiro.fechamentos_mensais where competencia=i.competencia and status='fechado') then 'competencia_fechada' end,
    case when not exists(select 1 from financeiro.sso_faturavel_alocacoes where item_id=i.id and documento_id=d.id) then 'primeira_parcela_ausente' end,
    case when exists(select 1 from financeiro.sso_documentos_internos doc where doc.item_id=i.id and not exists(select 1 from financeiro.sso_documentos_internos_liberacoes rel where rel.documento_interno_id=doc.id)) then 'reserva_ativa' end,
    case when i.valor_conferido_centavos is not null and (totais->>'itemCentavos')::numeric+p_valor_centavos>i.valor_conferido_centavos then 'saldo_item_insuficiente' end,
    case when (totais->>'documentoCentavos')::numeric+p_valor_centavos>l.valor_centavos then 'saldo_documento_insuficiente' end
  ],null);
  return jsonb_build_object('itemId',i.id,'documentoId',d.id,'impedimentos',to_jsonb(motivos),'consultaPrevia',true,'reservaSaldo',false,'resultadoPedidoAnterior','desconhecido','cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_previa_impedimentos_parcela(uuid,uuid,uuid,integer,bigint) from public,anon,authenticated,service_role;
