-- ADR-0184: comando conservador, sem operação financeira e gate fechado.
create table pcm.sso_correcao_despesa_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table pcm.sso_correcao_despesa_gate enable row level security;
alter table pcm.sso_correcao_despesa_gate force row level security;
revoke all on pcm.sso_correcao_despesa_gate from public, anon, authenticated, service_role;
insert into pcm.sso_correcao_despesa_gate(id, habilitado) values (true, false);

create function pcm.sso_corrigir_despesa_realizada(p_request_id uuid, p_despesa_id uuid,
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
    (f.status <> 'cancelado' or exists (select 1 from financeiro.sso_faturavel_alocacoes a where a.item_id = f.id))) then
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
revoke all on function pcm.sso_corrigir_despesa_realizada(uuid, uuid, integer, text, date, text, text, text)
  from public, anon, authenticated, service_role;
