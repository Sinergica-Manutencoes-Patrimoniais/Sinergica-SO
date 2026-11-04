-- ADR-0135: preparação sem grant; declarar repasse não emite cobrança.
create table financeiro.sso_declaracoes_repasse_despesa (
  item_id uuid primary key references financeiro.itens_faturaveis(id),
  despesa_id uuid not null unique references pcm.despesas_visita(id),
  despesa_revisao integer not null check (despesa_revisao > 0),
  visita_id uuid not null,
  valor_centavos bigint not null check (valor_centavos between 0 and 9007199254740991),
  regra_contratual text not null check (length(btrim(regra_contratual)) between 1 and 500),
  justificativa text not null check (length(btrim(justificativa)) between 1 and 2000),
  ator_id uuid not null references auth.users(id),
  request_id uuid not null unique,
  criado_em timestamptz not null default now()
);
alter table financeiro.sso_declaracoes_repasse_despesa enable row level security;
alter table financeiro.sso_declaracoes_repasse_despesa force row level security;
revoke all on financeiro.sso_declaracoes_repasse_despesa from public, anon, authenticated, service_role;

create function financeiro.sso_declarar_repasse_despesa(
  p_request_id uuid, p_despesa_id uuid, p_expected_revision integer,
  p_competencia date, p_regra_contratual text, p_justificativa text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid(); v_despesa pcm.despesas_visita%rowtype;
  v_item financeiro.itens_faturaveis%rowtype;
  v_declaracao financeiro.sso_declaracoes_repasse_despesa%rowtype;
  v_comando financeiro.sso_faturavel_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if v_ator is null or p_request_id is null or p_despesa_id is null
    or p_expected_revision is null or p_expected_revision < 1
    or p_competencia is null or not isfinite(p_competencia) or extract(day from p_competencia) <> 1
    or p_regra_contratual is null or length(btrim(p_regra_contratual)) not between 1 and 500
    or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('operacao', 'declarar_repasse_despesa', 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'competencia', p_competencia,
    'regraContratual', btrim(p_regra_contratual), 'justificativa', btrim(p_justificativa));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true
    or config.sso_autorizar_acao('faturavel.efetivar', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from financeiro.sso_faturavel_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_despesa.revisao <> p_expected_revision then
    raise exception 'revisao_divergente' using errcode = '40001';
  end if;
  if v_despesa.status <> 'ativa' or v_despesa.realizado_centavos is null then
    raise exception 'despesa_sem_realizado' using errcode = '23514';
  end if;
  select * into v_item from financeiro.itens_faturaveis
    where cliente_id = v_despesa.cliente_id and origem_tipo = 'despesa_visita' and origem_id = p_despesa_id
    for update;
  if found then
    select * into v_declaracao from financeiro.sso_declaracoes_repasse_despesa where item_id = v_item.id;
    if not found or v_item.valor_original_centavos is distinct from v_despesa.realizado_centavos
      or v_item.competencia is distinct from p_competencia
      or v_declaracao.despesa_revisao is distinct from v_despesa.revisao
      or v_declaracao.regra_contratual is distinct from btrim(p_regra_contratual)
      or v_declaracao.justificativa is distinct from btrim(p_justificativa) then
      raise exception 'origem_conflitante' using errcode = '23505';
    end if;
    v_resultado := jsonb_build_object('aggregateId', v_item.id, 'revision', v_item.revisao,
      'state', v_item.status, 'created', false, 'linkedIds', jsonb_build_object('despesaId', p_despesa_id),
      'warnings', '[]'::jsonb, 'requestId', p_request_id);
  else
    insert into financeiro.itens_faturaveis(id, cliente_id, origem_tipo, origem_id, valor_original_centavos, competencia)
      values (pg_catalog.gen_random_uuid(), v_despesa.cliente_id, 'despesa_visita', p_despesa_id,
        v_despesa.realizado_centavos, p_competencia) returning * into v_item;
    insert into financeiro.sso_declaracoes_repasse_despesa(item_id, despesa_id, despesa_revisao, visita_id,
      valor_centavos, regra_contratual, justificativa, ator_id, request_id)
      values (v_item.id, p_despesa_id, v_despesa.revisao, v_despesa.visita_id, v_despesa.realizado_centavos,
        btrim(p_regra_contratual), btrim(p_justificativa), v_ator, p_request_id);
    insert into audit.events(actor_id, action, entity, entity_id, payload)
      values (v_ator, 'faturavel.repasse_declarado', 'itens_faturaveis', v_item.id,
        jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id,
          'despesaId', p_despesa_id, 'despesaRevision', v_despesa.revisao));
    v_resultado := jsonb_build_object('aggregateId', v_item.id, 'revision', 1,
      'state', 'pendente', 'created', true, 'linkedIds', jsonb_build_object('despesaId', p_despesa_id),
      'warnings', '[]'::jsonb, 'requestId', p_request_id);
  end if;
  insert into financeiro.sso_faturavel_comandos(request_id, ator_id, payload, resultado)
    values(p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function financeiro.sso_declarar_repasse_despesa(uuid, uuid, integer, date, text, text)
  from public, anon, authenticated, service_role;
