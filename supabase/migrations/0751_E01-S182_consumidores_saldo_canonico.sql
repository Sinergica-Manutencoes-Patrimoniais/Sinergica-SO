-- ADR-0526: helper precisa observar alterações da própria transação.
alter function financeiro.sso_totais_alocacoes_ativas(uuid,uuid) volatile;
create or replace function financeiro.sso_selecionar_faturavel_documento(p_request_id uuid,p_item_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; anterior financeiro.sso_selecoes_documento%rowtype; alocado numeric; saldo bigint;
begin
  if not coalesce((select habilitado from financeiro.sso_selecao_documento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('selecao-faturavel:'||p_request_id::text,0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into i from financeiro.itens_faturaveis where id=p_item_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_selecoes_documento where id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.item_id is distinct from p_item_id or anterior.revisao_item<>p_expected_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'itemId',p_item_id,'revisaoItem',anterior.revisao_item,'saldoObservadoCentavos',anterior.saldo_centavos::text,'estado','selecao_local_nao_emitida','reservaSaldo',false);
  end if;
  if exists(select 1 from financeiro.sso_documentos_internos d where d.item_id=i.id and not exists(select 1 from financeiro.sso_documentos_internos_liberacoes l where l.documento_interno_id=d.id)) then raise exception 'reserva_ativa_existente' using errcode='23505'; end if;
  if i.revisao<>p_expected_revision then raise exception 'revisao_divergente' using errcode='40001'; end if;
  if i.status not in ('conferido','parcial') or i.valor_conferido_centavos is null then raise exception 'item_nao_conferido' using errcode='23514'; end if;
  if exists(select 1 from financeiro.fechamentos_mensais where competencia=i.competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  select (financeiro.sso_totais_alocacoes_ativas(i.id,null)->>'itemCentavos')::numeric into alocado;
  if alocado<0 or alocado>=i.valor_conferido_centavos then raise exception 'saldo_indisponivel' using errcode='23514'; end if;
  saldo:=(i.valor_conferido_centavos-alocado)::bigint;
  insert into financeiro.sso_selecoes_documento(id,cliente_id,item_id,revisao_item,origem_tipo,origem_id,competencia,saldo_centavos,ator_id)
    values(p_request_id,i.cliente_id,i.id,i.revisao,i.origem_tipo,i.origem_id,i.competencia,saldo,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.selecao_documento_local','itens_faturaveis',i.id,
    jsonb_build_object('requestId',p_request_id,'clienteId',i.cliente_id,'revisaoItem',i.revisao,'competencia',i.competencia));
  return jsonb_build_object('requestId',p_request_id,'itemId',i.id,'revisaoItem',i.revisao,'saldoObservadoCentavos',saldo::text,'estado','selecao_local_nao_emitida','reservaSaldo',false);
end $$;

create or replace function financeiro.sso_emitir_documento_interno(p_request_id uuid,p_selecao_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s financeiro.sso_selecoes_documento%rowtype; i financeiro.itens_faturaveis%rowtype; d financeiro.sso_documentos_internos%rowtype; alocado numeric; saldo numeric;
begin
  if not coalesce((select habilitado from financeiro.sso_documento_interno_gate where id),false) or not coalesce((select habilitado from financeiro.sso_selecao_documento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_selecao_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento-interno:'||p_request_id::text,0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into s from financeiro.sso_selecoes_documento where id=p_selecao_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',s.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=s.item_id and cliente_id=s.cliente_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',s.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into d from financeiro.sso_documentos_internos where id=p_request_id;
  if found then
    if d.ator_id is distinct from auth.uid() or d.selecao_id is distinct from p_selecao_id then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'documentoInternoId',d.id,'itemId',d.item_id,'valorReservadoCentavos',d.valor_centavos::text,'estado','interno_nao_fiscal','cobrancaEnviada',false);
  end if;
  if i.revisao<>s.revisao_item or i.origem_tipo is distinct from s.origem_tipo or i.origem_id is distinct from s.origem_id or i.competencia is distinct from s.competencia
    or i.status not in ('conferido','parcial') or i.valor_conferido_centavos is null then raise exception 'selecao_obsoleta' using errcode='40001'; end if;
  if exists(select 1 from financeiro.fechamentos_mensais where competencia=i.competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  select (financeiro.sso_totais_alocacoes_ativas(i.id,null)->>'itemCentavos')::numeric into alocado;
  saldo:=i.valor_conferido_centavos-alocado;
  if saldo<=0 or saldo<>s.saldo_centavos then raise exception 'saldo_obsoleto' using errcode='40001'; end if;
  insert into financeiro.sso_documentos_internos(id,selecao_id,cliente_id,item_id,revisao_item,origem_tipo,origem_id,competencia,valor_centavos,ator_id)
    values(p_request_id,s.id,i.cliente_id,i.id,i.revisao,i.origem_tipo,i.origem_id,i.competencia,saldo::bigint,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.documento_interno_reservado','itens_faturaveis',i.id,
    jsonb_build_object('requestId',p_request_id,'clienteId',i.cliente_id,'selecaoId',s.id,'revisaoItem',i.revisao));
  return jsonb_build_object('requestId',p_request_id,'documentoInternoId',p_request_id,'itemId',i.id,'valorReservadoCentavos',saldo::bigint::text,'estado','interno_nao_fiscal','cobrancaEnviada',false);
end $$;

create or replace function financeiro.sso_emitir_documento_interno_parcial(p_request_id uuid,p_selecao_id uuid,p_valor_centavos bigint)
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
  select (financeiro.sso_totais_alocacoes_ativas(i.id,null)->>'itemCentavos')::numeric into alocado;
  saldo:=i.valor_conferido_centavos-alocado;
  if saldo<=0 or saldo<>s.saldo_centavos or p_valor_centavos>saldo then raise exception 'saldo_obsoleto' using errcode='40001'; end if;
  insert into financeiro.sso_documentos_internos(id,selecao_id,cliente_id,item_id,revisao_item,origem_tipo,origem_id,competencia,valor_centavos,ator_id)
    values(p_request_id,s.id,i.cliente_id,i.id,i.revisao,i.origem_tipo,i.origem_id,i.competencia,p_valor_centavos,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.documento_interno_reservado','itens_faturaveis',i.id,
    jsonb_build_object('requestId',p_request_id,'clienteId',i.cliente_id,'selecaoId',s.id,'revisaoItem',i.revisao));
  return jsonb_build_object('requestId',p_request_id,'documentoInternoId',p_request_id,'itemId',i.id,'valorReservadoCentavos',p_valor_centavos::text,'estado','interno_nao_fiscal','cobrancaEnviada',false);
end $$;
create or replace function financeiro.sso_estornar_alocacao(p_request_id uuid, p_estorno_id uuid, p_item_id uuid,
  p_expected_revision integer, p_alocacao_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_item financeiro.itens_faturaveis%rowtype; v_alocacao financeiro.sso_faturavel_alocacoes%rowtype;
  v_documento financeiro.sso_faturavel_documentos%rowtype; v_comando financeiro.sso_faturavel_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_saldo_alocado numeric;
begin
  if auth.uid() is null or p_request_id is null or p_estorno_id is null or p_item_id is null or p_alocacao_id is null
    or p_expected_revision is null or p_expected_revision < 1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faturavel:' || p_request_id::text, 0));
  lock table financeiro.fechamentos_mensais in share mode;
  select a.* into v_alocacao from financeiro.sso_faturavel_alocacoes a where a.id = p_alocacao_id and a.item_id = p_item_id;
  if not found then raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_documento from financeiro.sso_faturavel_documentos where id = v_alocacao.documento_id;
  perform 1 from financeiro.lancamentos l where l.id = v_documento.lancamento_id for update;
  select * into v_item from financeiro.itens_faturaveis where id = p_item_id for update;
  if not found or v_documento.cliente_id is distinct from v_item.cliente_id
    or config.sso_autorizar_acao('faturavel.efetivar', v_item.cliente_id) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'estornar_alocacao', 'estornoId', p_estorno_id,
    'itemId', p_item_id, 'expectedRevision', p_expected_revision, 'alocacaoId', p_alocacao_id, 'motivo', btrim(p_motivo));
  select * into v_comando from financeiro.sso_faturavel_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id), false) then
    raise exception 'faturamento_indisponivel' using errcode = '55000'; end if;
  if v_item.revisao <> p_expected_revision then raise exception 'revisao_divergente' using errcode = '40001'; end if;
  if v_item.status not in ('parcial', 'faturado') or v_item.valor_conferido_centavos is null then
    raise exception 'estado_invalido' using errcode = '23514'; end if;
  if exists (select 1 from financeiro.fechamentos_mensais where competencia = v_item.competencia and status = 'fechado') then
    raise exception 'competencia_fechada' using errcode = '23514'; end if;
  insert into financeiro.sso_faturavel_estornos(id, alocacao_id, item_id, valor_centavos, motivo, revisao_item, ator_id, request_id)
    values (p_estorno_id, p_alocacao_id, p_item_id, v_alocacao.valor_centavos, btrim(p_motivo), v_item.revisao + 1, auth.uid(), p_request_id);
  select (financeiro.sso_totais_alocacoes_ativas(p_item_id,null)->>'itemCentavos')::numeric into v_saldo_alocado;
  if v_saldo_alocado > v_item.valor_conferido_centavos then raise exception 'saldo_invalido' using errcode = '23514'; end if;
  update financeiro.itens_faturaveis set revisao = revisao + 1,
    status = case when v_saldo_alocado = 0 then 'conferido' else 'parcial' end
    where id = p_item_id returning * into v_item;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'faturavel.estorno_logico', 'itens_faturaveis', p_item_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_item.cliente_id, 'revision', v_item.revisao,
        'documentoId', v_documento.id, 'alocacaoId', p_alocacao_id, 'estornoId', p_estorno_id));
  v_resultado := jsonb_build_object('aggregateId', p_item_id, 'revision', v_item.revisao, 'state', v_item.status,
    'requestId', p_request_id, 'saldoCentavos', v_item.valor_conferido_centavos - v_saldo_alocado,
    'linkedIds', jsonb_build_object('documentoId', v_documento.id, 'alocacaoId', p_alocacao_id, 'estornoId', p_estorno_id));
  insert into financeiro.sso_faturavel_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;

create or replace function financeiro.sso_alocar_faturavel_documento(p_request_id uuid, p_alocacao_id uuid,
  p_item_id uuid, p_expected_revision integer, p_lancamento_id uuid, p_documento_ref text,
  p_data_documento date, p_valor_centavos bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_item financeiro.itens_faturaveis%rowtype; v_lancamento financeiro.lancamentos%rowtype;
  v_documento financeiro.sso_faturavel_documentos%rowtype; v_comando financeiro.sso_faturavel_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_total_item numeric; v_total_documento numeric;
begin
  if auth.uid() is null or p_request_id is null or p_alocacao_id is null or p_item_id is null
    or p_expected_revision is null or p_expected_revision < 1 or p_lancamento_id is null
    or p_documento_ref is null or length(btrim(p_documento_ref)) not between 1 and 200
    or p_data_documento is null or not isfinite(p_data_documento)
    or p_valor_centavos is null or p_valor_centavos not between 1 and 9007199254740991 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faturavel:' || p_request_id::text, 0));
  -- Evita inserção concorrente do primeiro registro de fechamento durante a operação.
  lock table financeiro.fechamentos_mensais in share mode;
  select * into v_lancamento from financeiro.lancamentos where id = p_lancamento_id for update;
  select * into v_item from financeiro.itens_faturaveis where id = p_item_id for update;
  if not found or v_lancamento.id is null or v_lancamento.tipo <> 'entrada'
    or v_lancamento.cliente_id is distinct from v_item.cliente_id
    or config.sso_autorizar_acao('faturavel.efetivar', v_item.cliente_id) is not true then
    raise exception 'item_ou_lancamento_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'alocar_documento', 'alocacaoId', p_alocacao_id,
    'itemId', p_item_id, 'expectedRevision', p_expected_revision, 'lancamentoId', p_lancamento_id,
    'documentoRef', btrim(p_documento_ref), 'dataDocumento', p_data_documento, 'valorCentavos', p_valor_centavos);
  select * into v_comando from financeiro.sso_faturavel_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not coalesce((select g.habilitado from financeiro.sso_faturamento_gate g where g.id), false) then
    raise exception 'faturamento_indisponivel' using errcode = '55000'; end if;
  if v_item.revisao <> p_expected_revision then raise exception 'revisao_divergente' using errcode = '40001'; end if;
  if v_item.status not in ('conferido', 'parcial') or v_item.valor_conferido_centavos is null then
    raise exception 'estado_invalido' using errcode = '23514'; end if;
  if date_trunc('month', v_lancamento.data_competencia)::date <> v_item.competencia then raise exception 'competencia_divergente' using errcode = '23514'; end if;
  if exists (select 1 from financeiro.fechamentos_mensais f where f.competencia = v_item.competencia and f.status = 'fechado') then
    raise exception 'competencia_fechada' using errcode = '23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento:' || v_item.cliente_id::text || ':' || btrim(p_documento_ref), 0));
  select * into v_documento from financeiro.sso_faturavel_documentos where lancamento_id = p_lancamento_id for update;
  if found then
    if v_documento.cliente_id is distinct from v_item.cliente_id or v_documento.referencia is distinct from btrim(p_documento_ref)
      or v_documento.data_documento is distinct from p_data_documento then raise exception 'documento_conflitante' using errcode = '23505'; end if;
  else
    insert into financeiro.sso_faturavel_documentos(cliente_id, referencia, lancamento_id, data_documento, criado_por)
      values (v_item.cliente_id, btrim(p_documento_ref), p_lancamento_id, p_data_documento, auth.uid()) returning * into v_documento;
  end if;
  select (financeiro.sso_totais_alocacoes_ativas(p_item_id,null)->>'itemCentavos')::numeric into v_total_item;
  select (financeiro.sso_totais_alocacoes_ativas(null,v_documento.id)->>'documentoCentavos')::numeric into v_total_documento;
  if v_total_item + p_valor_centavos > v_item.valor_conferido_centavos
    or v_total_documento + p_valor_centavos > v_lancamento.valor_centavos then
    raise exception 'saldo_insuficiente' using errcode = '23514'; end if;
  insert into financeiro.sso_faturavel_alocacoes(id, item_id, documento_id, valor_centavos, revisao_item, request_id, ator_id)
    values (p_alocacao_id, p_item_id, v_documento.id, p_valor_centavos, v_item.revisao + 1, p_request_id, auth.uid());
  update financeiro.itens_faturaveis set revisao = revisao + 1,
    status = case when v_total_item + p_valor_centavos = valor_conferido_centavos then 'faturado' else 'parcial' end
    where id = p_item_id returning * into v_item;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'faturavel.alocado_documento', 'itens_faturaveis', p_item_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_item.cliente_id, 'revision', v_item.revisao,
        'documentoId', v_documento.id, 'alocacaoId', p_alocacao_id));
  v_resultado := jsonb_build_object('aggregateId', p_item_id, 'revision', v_item.revisao, 'state', v_item.status,
    'requestId', p_request_id, 'saldoCentavos', v_item.valor_conferido_centavos - v_total_item - p_valor_centavos,
    'linkedIds', jsonb_build_object('documentoId', v_documento.id, 'alocacaoId', p_alocacao_id, 'lancamentoId', p_lancamento_id));
  insert into financeiro.sso_faturavel_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;

create or replace function financeiro.sso_saldo_faturavel(p_item_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_item financeiro.itens_faturaveis%rowtype; v_total numeric;
begin
  select * into v_item from financeiro.itens_faturaveis where id = p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar', v_item.cliente_id) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select (financeiro.sso_totais_alocacoes_ativas(p_item_id,null)->>'itemCentavos')::numeric into v_total;
  if v_item.valor_conferido_centavos is null or v_total > v_item.valor_conferido_centavos then
    raise exception 'saldo_indisponivel' using errcode = '23514'; end if;
  return (v_item.valor_conferido_centavos - v_total)::bigint;
end;
$$;
