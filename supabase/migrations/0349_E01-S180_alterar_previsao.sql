-- ADR-0124: gate fechado; não altera lançamento financeiro nem elimina histórico.
create table pcm.despesa_visita_eventos (
  despesa_id uuid not null references pcm.despesas_visita(id),
  revisao integer not null check (revisao > 1),
  acao text not null check (acao in ('alterada', 'cancelada')),
  antes jsonb not null, depois jsonb not null,
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  ator_id uuid not null references auth.users(id),
  request_id uuid not null unique, ocorrido_em timestamptz not null default now(),
  primary key (despesa_id, revisao)
);
alter table pcm.despesa_visita_eventos enable row level security;
alter table pcm.despesa_visita_eventos force row level security;
revoke all on pcm.despesa_visita_eventos from public, anon, authenticated, service_role;

create function pcm.sso_alterar_previsao_visita(
  p_request_id uuid, p_despesa_id uuid, p_expected_revision integer, p_acao text,
  p_data date, p_descricao text, p_previsto_centavos bigint, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_despesa pcm.despesas_visita%rowtype;
  v_antes jsonb; v_depois jsonb; v_payload jsonb; v_resultado jsonb;
  v_comando pcm.despesa_visita_comandos%rowtype;
begin
  if v_ator is null or p_request_id is null or p_despesa_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_acao is null or p_acao not in ('alterar', 'cancelar')
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or (p_acao = 'alterar' and (p_data is null or not isfinite(p_data) or p_descricao is null
      or length(btrim(p_descricao)) not between 1 and 10000 or p_previsto_centavos is null
      or p_previsto_centavos not between 0 and 9007199254740991))
    or (p_acao = 'cancelar' and (p_data is not null or p_descricao is not null or p_previsto_centavos is not null)) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found then raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.visitas where id = v_despesa.visita_id and cliente_id = v_despesa.cliente_id for share;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('operacao', p_acao, 'despesaId', p_despesa_id, 'expectedRevision', p_expected_revision,
    'data', p_data, 'descricao', p_descricao, 'previstoCentavos', p_previsto_centavos, 'motivo', p_motivo);
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_despesa.revisao <> p_expected_revision or v_despesa.status <> 'ativa' then
    raise exception 'revisao_ou_estado_invalido' using errcode = '40001';
  end if;
  if v_despesa.realizado_centavos is not null then raise exception 'realizado_exige_fluxo_financeiro' using errcode = '23514'; end if;
  v_antes := jsonb_build_object('data', v_despesa.data, 'descricao', v_despesa.descricao,
    'previstoCentavos', v_despesa.previsto_centavos, 'status', v_despesa.status);
  update pcm.despesas_visita set data = case when p_acao = 'alterar' then p_data else data end,
    descricao = case when p_acao = 'alterar' then btrim(p_descricao) else descricao end,
    previsto_centavos = case when p_acao = 'alterar' then p_previsto_centavos else previsto_centavos end,
    status = case when p_acao = 'cancelar' then 'cancelada' else status end, revisao = revisao + 1
    where id = p_despesa_id returning * into v_despesa;
  v_depois := jsonb_build_object('data', v_despesa.data, 'descricao', v_despesa.descricao,
    'previstoCentavos', v_despesa.previsto_centavos, 'status', v_despesa.status);
  insert into pcm.despesa_visita_eventos(despesa_id, revisao, acao, antes, depois, motivo, ator_id, request_id)
    values (p_despesa_id, v_despesa.revisao, case when p_acao = 'alterar' then 'alterada' else 'cancelada' end,
      v_antes, v_depois, p_motivo, v_ator, p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'despesa_visita.' || p_acao, 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id, 'revision', v_despesa.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', v_despesa.revisao,
    'state', v_despesa.status, 'created', false, 'linkedIds', jsonb_build_object('visitaId', v_despesa.visita_id),
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_ator, v_despesa.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_alterar_previsao_visita(uuid, uuid, integer, text, date, text, bigint, text) from public, anon, authenticated, service_role;
