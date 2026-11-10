-- ADR-0529: preservar histórico mesmo quando estornado; não converter existência em saldo.
create function financeiro.sso_tem_historico_alocacao(p_item_id uuid,p_documento_id uuid,p_lancamento_id uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
  if num_nonnulls(p_item_id,p_documento_id,p_lancamento_id)<>1 then raise exception 'origem_invalida' using errcode='22023'; end if;
  return exists(select 1 from financeiro.sso_faturavel_alocacoes a join financeiro.sso_faturavel_documentos d on d.id=a.documento_id
    where (p_item_id is not null and a.item_id=p_item_id) or (p_documento_id is not null and a.documento_id=p_documento_id)
      or (p_lancamento_id is not null and d.lancamento_id=p_lancamento_id));
end $$;
revoke all on function financeiro.sso_tem_historico_alocacao(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function financeiro.sso_proteger_lancamento_faturavel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from financeiro.sso_faturamento_gate g where g.id), false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if financeiro.sso_tem_historico_alocacao(null,null,old.id)
    or exists (select 1 from financeiro.sso_faturavel_conferencias_estorno c where c.lancamento_saida_id = old.id) then
    if tg_op = 'DELETE' then raise exception 'lancamento_faturavel_exige_fluxo_coordenado' using errcode = '23514'; end if;
    if new.tipo is distinct from old.tipo or new.cliente_id is distinct from old.cliente_id
      or new.os_id is distinct from old.os_id or new.data_competencia is distinct from old.data_competencia
      or new.valor_centavos is distinct from old.valor_centavos or new.origem is distinct from old.origem
      or new.categoria_id is distinct from old.categoria_id or new.conta_id is distinct from old.conta_id
      or new.data_vencimento is distinct from old.data_vencimento
      or (old.status = 'realizado' and (new.status is distinct from old.status or new.data_pagamento is distinct from old.data_pagamento)) then
      raise exception 'lancamento_faturavel_exige_fluxo_coordenado' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;
create or replace function pcm.sso_corrigir_despesa_realizada(p_request_id uuid, p_despesa_id uuid,
  p_expected_revision integer, p_acao text, p_data date, p_descricao text, p_motivo text,
  p_conferencia_financeira text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_despesa pcm.despesas_visita%rowtype; v_comando pcm.despesa_visita_comandos%rowtype;
  v_payload jsonb; v_antes jsonb; v_depois jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_despesa_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_acao is null or p_acao not in ('corrigir', 'cancelar')
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or p_conferencia_financeira is null or length(btrim(p_conferencia_financeira)) not between 1 and 2000
    or (p_acao = 'corrigir' and (p_data is null or not isfinite(p_data) or p_descricao is null or length(btrim(p_descricao)) not between 1 and 10000))
    or (p_acao = 'cancelar' and (p_data is not null or p_descricao is not null)) then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'realizada_' || p_acao, 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'data', p_data, 'descricao', p_descricao,
    'motivo', btrim(p_motivo), 'conferenciaFinanceira', btrim(p_conferencia_financeira));
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not coalesce((select habilitado from pcm.sso_correcao_despesa_gate where id), false) then
    raise exception 'correcao_indisponivel' using errcode = '55000'; end if;
  if v_despesa.revisao <> p_expected_revision or v_despesa.status <> 'ativa' then
    raise exception 'revisao_ou_estado_invalido' using errcode = '40001'; end if;
  if v_despesa.realizado_centavos is null or not exists (select 1 from pcm.despesa_visita_realizacoes r where r.despesa_id = p_despesa_id) then
    raise exception 'realizacao_nao_comprovada' using errcode = '23514'; end if;
  -- Não pressupor que estorno lógico seja estorno Financeiro; manter bloqueado em qualquer alocação.
  if exists (select 1 from financeiro.itens_faturaveis f where f.cliente_id = v_despesa.cliente_id
    and f.origem_tipo = 'despesa_visita' and f.origem_id = p_despesa_id and
    (f.status <> 'cancelado' or financeiro.sso_tem_historico_alocacao(f.id,null,null))) then
    raise exception 'origem_exige_reconciliacao_financeira' using errcode = '23514'; end if;
  v_antes := jsonb_build_object('data', v_despesa.data, 'descricao', v_despesa.descricao,
    'previstoCentavos', v_despesa.previsto_centavos, 'realizadoCentavos', v_despesa.realizado_centavos, 'status', v_despesa.status);
  update pcm.despesas_visita set data = case when p_acao = 'corrigir' then p_data else data end,
    descricao = case when p_acao = 'corrigir' then btrim(p_descricao) else descricao end,
    status = case when p_acao = 'cancelar' then 'cancelada' else status end, revisao = revisao + 1
    where id = p_despesa_id returning * into v_despesa;
  v_depois := jsonb_build_object('data', v_despesa.data, 'descricao', v_despesa.descricao,
    'previstoCentavos', v_despesa.previsto_centavos, 'realizadoCentavos', v_despesa.realizado_centavos,
    'status', v_despesa.status, 'conferenciaFinanceira', btrim(p_conferencia_financeira));
  insert into pcm.despesa_visita_eventos(despesa_id, revisao, acao, antes, depois, motivo, ator_id, request_id)
    values (p_despesa_id, v_despesa.revisao, case when p_acao = 'corrigir' then 'alterada' else 'cancelada' end,
      v_antes, v_depois, btrim(p_motivo), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'despesa_visita.realizada_' || p_acao, 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id, 'revision', v_despesa.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', v_despesa.revisao,
    'state', v_despesa.status, 'requestId', p_request_id, 'linkedIds', jsonb_build_object('visitaId', v_despesa.visita_id));
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, auth.uid(), v_despesa.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;

create or replace function pcm.sso_corrigir_realizacao_despesa(p_request_id uuid, p_despesa_id uuid,
  p_expected_revision integer, p_valor_centavos bigint, p_comprovante_objeto_id uuid,
  p_motivo text, p_conferencia_financeira text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_despesa pcm.despesas_visita%rowtype; v_comando pcm.despesa_visita_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_objeto_antigo uuid; v_caminho_antigo text;
  v_objeto_novo uuid; v_caminho_novo text; v_valor_antigo bigint;
begin
  if auth.uid() is null or p_request_id is null or p_despesa_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_valor_centavos is null or p_valor_centavos not between 0 and 9007199254740991
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or p_conferencia_financeira is null or length(btrim(p_conferencia_financeira)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'corrigir_realizacao', 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'valorCentavos', p_valor_centavos, 'comprovanteObjetoId', p_comprovante_objeto_id,
    'motivo', btrim(p_motivo), 'conferenciaFinanceira', btrim(p_conferencia_financeira));
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not coalesce((select habilitado from pcm.sso_correcao_despesa_gate where id), false) then
    raise exception 'correcao_indisponivel' using errcode = '55000'; end if;
  if v_despesa.revisao <> p_expected_revision or v_despesa.status <> 'ativa' then
    raise exception 'revisao_ou_estado_invalido' using errcode = '40001'; end if;
  if v_despesa.realizado_centavos is null then raise exception 'realizacao_nao_comprovada' using errcode = '23514'; end if;
  if exists (select 1 from financeiro.itens_faturaveis f where f.cliente_id = v_despesa.cliente_id
    and f.origem_tipo = 'despesa_visita' and f.origem_id = p_despesa_id and
    (f.status <> 'cancelado' or financeiro.sso_tem_historico_alocacao(f.id,null,null))) then
    raise exception 'origem_exige_reconciliacao_financeira' using errcode = '23514'; end if;
  select c.objeto_novo, c.caminho_novo into v_objeto_antigo, v_caminho_antigo
    from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id = p_despesa_id order by c.revisao desc limit 1;
  if not found then select r.comprovante_objeto_id, r.comprovante_caminho into v_objeto_antigo, v_caminho_antigo
    from pcm.despesa_visita_realizacoes r where r.despesa_id = p_despesa_id; end if;
  if v_objeto_antigo is null then raise exception 'realizacao_nao_comprovada' using errcode = '23514'; end if;
  v_objeto_novo := coalesce(p_comprovante_objeto_id, v_objeto_antigo);
  if p_comprovante_objeto_id is null then v_caminho_novo := v_caminho_antigo;
  else
    select o.name into v_caminho_novo from storage.objects o join storage.buckets b on b.id = o.bucket_id
      where o.id = p_comprovante_objeto_id and o.bucket_id = 'sso-despesas-visita' and b.public is false
        and o.owner_id = auth.uid()::text and split_part(o.name, '/', 1) = v_despesa.cliente_id::text
        and split_part(o.name, '/', 2) = p_despesa_id::text and pcm.sso_autorizar_upload_comprovante(o.name) is true for share of o;
    if not found or exists (select 1 from pcm.despesa_visita_realizacoes r where r.comprovante_objeto_id = p_comprovante_objeto_id)
      or exists (select 1 from pcm.despesa_visita_correcoes_realizacao c where c.objeto_novo = p_comprovante_objeto_id) then
      raise exception 'comprovante_indisponivel' using errcode = '23514'; end if;
  end if;
  if v_despesa.realizado_centavos = p_valor_centavos and v_objeto_antigo = v_objeto_novo then
    raise exception 'nenhuma_alteracao' using errcode = '22023'; end if;
  v_valor_antigo := v_despesa.realizado_centavos;
  update pcm.despesas_visita set realizado_centavos = p_valor_centavos, revisao = revisao + 1
    where id = p_despesa_id returning * into v_despesa;
  insert into pcm.despesa_visita_correcoes_realizacao(despesa_id, revisao, valor_anterior, valor_novo,
    objeto_anterior, caminho_anterior, objeto_novo, caminho_novo, motivo, conferencia_financeira, ator_id, request_id)
    values (p_despesa_id, v_despesa.revisao, v_valor_antigo, p_valor_centavos, v_objeto_antigo, v_caminho_antigo,
      v_objeto_novo, v_caminho_novo, btrim(p_motivo), btrim(p_conferencia_financeira), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'despesa_visita.realizacao_corrigida', 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id, 'revision', v_despesa.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', v_despesa.revisao,
    'state', v_despesa.status, 'requestId', p_request_id, 'linkedIds', jsonb_build_object('visitaId', v_despesa.visita_id));
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, auth.uid(), v_despesa.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;

create or replace function financeiro.sso_corrigir_modo_proposta(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_revisao integer,p_modo text,p_motivo text)
returns integer language plpgsql security definer set search_path='' as $$
declare base financeiro.sso_modo_faturamento_propostas%rowtype; anterior financeiro.sso_modo_faturamento_correcoes%rowtype; v_revisao integer; v_modo text;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_proposta_id is null or p_revisao is null or p_revisao<1
    or p_modo is null or p_modo not in ('integral','linhas') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('correcao-modo:'||p_request_id::text,0));
  perform 1 from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into base from financeiro.sso_modo_faturamento_propostas where proposta_id=p_proposta_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_modo_faturamento_correcoes where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.proposta_id<>p_proposta_id or anterior.revisao<>p_revisao+1 or anterior.modo_novo<>p_modo or anterior.motivo<>btrim(p_motivo)
      then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.revisao;
  end if;
  select c.revisao,c.modo_novo into v_revisao,v_modo from financeiro.sso_modo_faturamento_correcoes c where c.proposta_id=p_proposta_id order by c.revisao desc limit 1;
  if not found then v_revisao:=1; v_modo:=base.modo; end if;
  if v_revisao<>p_revisao or v_modo=p_modo then raise exception 'revisao_ou_modo_invalido' using errcode='40001'; end if;
  if exists(select 1 from financeiro.itens_faturaveis i where i.cliente_id=p_cliente_id
    and ((i.origem_tipo='proposta_operacional' and i.origem_id=p_proposta_id) or (i.origem_tipo='material_proposta_linha'
      and exists(select 1 from financeiro.sso_material_linha_proposta x where x.declaracao_id=i.origem_id and x.proposta_id=p_proposta_id)))
    and (i.status<>'cancelado' or financeiro.sso_tem_historico_alocacao(i.id,null,null)))
    then raise exception 'faturavel_ou_alocacao_existente' using errcode='23514'; end if;
  insert into financeiro.sso_modo_faturamento_correcoes(proposta_id,revisao,modo_anterior,modo_novo,motivo,request_id,ator_id)
    values(p_proposta_id,v_revisao+1,v_modo,p_modo,btrim(p_motivo),p_request_id,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.modo_proposta_corrigido','propostas',p_proposta_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revisao',v_revisao+1,'modoAnterior',v_modo,'modoNovo',p_modo));
  return v_revisao+1;
end $$;
