-- ADR-0503: parcela parcial interna; sem emissão fiscal ou pagamento.
create function financeiro.sso_emitir_documento_interno_parcial(p_request_id uuid,p_selecao_id uuid,p_valor_centavos bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s financeiro.sso_selecoes_documento%rowtype; i financeiro.itens_faturaveis%rowtype; d financeiro.sso_documentos_internos%rowtype; alocado numeric; saldo numeric;
begin
  if not coalesce((select habilitado from financeiro.sso_documento_interno_gate where id),false) or not coalesce((select habilitado from financeiro.sso_selecao_documento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_selecao_id is null or p_valor_centavos is null or p_valor_centavos<=0 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento-interno:'||p_request_id::text,0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into s from financeiro.sso_selecoes_documento where id=p_selecao_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',s.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=s.item_id and cliente_id=s.cliente_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',s.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into d from financeiro.sso_documentos_internos where id=p_request_id;
  if found then
    if d.ator_id is distinct from auth.uid() or d.selecao_id is distinct from p_selecao_id or d.valor_centavos is distinct from p_valor_centavos then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'documentoInternoId',d.id,'itemId',d.item_id,'valorReservadoCentavos',d.valor_centavos::text,'estado','interno_nao_fiscal','cobrancaEnviada',false);
  end if;
  if i.revisao<>s.revisao_item or i.origem_tipo is distinct from s.origem_tipo or i.origem_id is distinct from s.origem_id or i.competencia is distinct from s.competencia
    or i.status not in ('conferido','parcial') or i.valor_conferido_centavos is null then raise exception 'selecao_obsoleta' using errcode='40001'; end if;
  if exists(select 1 from financeiro.fechamentos_mensais where competencia=i.competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  select coalesce(sum(a.valor_centavos) filter(where e.id is null),0) into alocado from financeiro.sso_faturavel_alocacoes a left join financeiro.sso_faturavel_estornos e on e.alocacao_id=a.id where a.item_id=i.id;
  saldo:=i.valor_conferido_centavos-alocado;
  if saldo<=0 or saldo<>s.saldo_centavos or p_valor_centavos>saldo then raise exception 'saldo_obsoleto' using errcode='40001'; end if;
  insert into financeiro.sso_documentos_internos(id,selecao_id,cliente_id,item_id,revisao_item,origem_tipo,origem_id,competencia,valor_centavos,ator_id)
    values(p_request_id,s.id,i.cliente_id,i.id,i.revisao,i.origem_tipo,i.origem_id,i.competencia,p_valor_centavos,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.documento_interno_reservado','itens_faturaveis',i.id,
    jsonb_build_object('requestId',p_request_id,'clienteId',i.cliente_id,'selecaoId',s.id,'revisaoItem',i.revisao));
  return jsonb_build_object('requestId',p_request_id,'documentoInternoId',p_request_id,'itemId',i.id,'valorReservadoCentavos',p_valor_centavos::text,'estado','interno_nao_fiscal','cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_emitir_documento_interno_parcial(uuid,uuid,bigint) from public,anon,authenticated,service_role;
