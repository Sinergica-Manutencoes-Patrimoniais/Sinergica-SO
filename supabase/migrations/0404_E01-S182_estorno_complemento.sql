-- ADR-0178: sem grant, gate de faturamento permanece fechado.
alter table financeiro.itens_faturaveis add column item_base_id uuid references financeiro.itens_faturaveis(id);
alter table financeiro.itens_faturaveis add column complemento_id uuid unique;
alter table financeiro.itens_faturaveis add constraint sso_complemento_identidade
  check ((item_base_id is null and complemento_id is null) or (item_base_id is not null and complemento_id is not null and item_base_id <> id));
alter table financeiro.itens_faturaveis drop constraint itens_faturaveis_cliente_id_origem_tipo_origem_id_key;
create unique index sso_faturavel_origem_base on financeiro.itens_faturaveis(cliente_id, origem_tipo, origem_id) where item_base_id is null;

create table financeiro.sso_faturavel_complementos (
  item_id uuid primary key references financeiro.itens_faturaveis(id),
  item_base_id uuid not null references financeiro.itens_faturaveis(id),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  ator_id uuid not null references config.usuarios(user_id), request_id uuid not null unique,
  criado_em timestamptz not null default now()
);
create table financeiro.sso_faturavel_estornos (
  id uuid primary key, alocacao_id uuid not null unique references financeiro.sso_faturavel_alocacoes(id),
  item_id uuid not null references financeiro.itens_faturaveis(id),
  valor_centavos bigint not null check (valor_centavos > 0), motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  revisao_item integer not null check (revisao_item > 1), ator_id uuid not null references config.usuarios(user_id),
  request_id uuid not null unique, criado_em timestamptz not null default now()
);
alter table financeiro.sso_faturavel_complementos enable row level security;
alter table financeiro.sso_faturavel_complementos force row level security;
alter table financeiro.sso_faturavel_estornos enable row level security;
alter table financeiro.sso_faturavel_estornos force row level security;
revoke all on financeiro.sso_faturavel_complementos, financeiro.sso_faturavel_estornos from public, anon, authenticated, service_role;

create function financeiro.sso_complementar_faturavel(p_request_id uuid, p_item_base_id uuid,
  p_expected_revision integer, p_item_id uuid, p_complemento_id uuid, p_valor_centavos bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_base financeiro.itens_faturaveis%rowtype; v_comando financeiro.sso_faturavel_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_item_base_id is null or p_item_id is null or p_complemento_id is null
    or p_expected_revision is null or p_expected_revision < 1 or p_valor_centavos is null
    or p_valor_centavos not between 1 and 9007199254740991 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faturavel:' || p_request_id::text, 0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into v_base from financeiro.itens_faturaveis where id = p_item_base_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar', v_base.cliente_id) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'complementar', 'itemBaseId', p_item_base_id,
    'expectedRevision', p_expected_revision, 'itemId', p_item_id, 'complementoId', p_complemento_id,
    'valorCentavos', p_valor_centavos, 'motivo', btrim(p_motivo));
  select * into v_comando from financeiro.sso_faturavel_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id), false) then
    raise exception 'faturamento_indisponivel' using errcode = '55000'; end if;
  if v_base.revisao <> p_expected_revision then raise exception 'revisao_divergente' using errcode = '40001'; end if;
  if v_base.item_base_id is not null or v_base.status = 'cancelado' then raise exception 'base_invalida' using errcode = '23514'; end if;
  if exists (select 1 from financeiro.fechamentos_mensais where competencia = v_base.competencia and status = 'fechado') then
    raise exception 'competencia_fechada' using errcode = '23514'; end if;
  insert into financeiro.itens_faturaveis(id, cliente_id, origem_tipo, origem_id, valor_original_centavos,
    competencia, item_base_id, complemento_id)
    values (p_item_id, v_base.cliente_id, v_base.origem_tipo, v_base.origem_id, p_valor_centavos,
      v_base.competencia, v_base.id, p_complemento_id);
  insert into financeiro.sso_faturavel_complementos(item_id, item_base_id, motivo, ator_id, request_id)
    values (p_item_id, p_item_base_id, btrim(p_motivo), auth.uid(), p_request_id);
  update financeiro.itens_faturaveis set revisao = revisao + 1 where id = p_item_base_id returning * into v_base;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'faturavel.complementado', 'itens_faturaveis', p_item_base_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_base.cliente_id, 'revision', v_base.revisao, 'complementoId', p_item_id));
  v_resultado := jsonb_build_object('aggregateId', p_item_base_id, 'revision', v_base.revisao,
    'state', v_base.status, 'requestId', p_request_id, 'linkedIds', jsonb_build_object('complementoId', p_item_id));
  insert into financeiro.sso_faturavel_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function financeiro.sso_complementar_faturavel(uuid, uuid, integer, uuid, uuid, bigint, text)
  from public, anon, authenticated, service_role;

create function financeiro.sso_estornar_alocacao(p_request_id uuid, p_estorno_id uuid, p_item_id uuid,
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
  select coalesce(sum(a.valor_centavos) filter (where e.id is null), 0) into v_saldo_alocado
    from financeiro.sso_faturavel_alocacoes a left join financeiro.sso_faturavel_estornos e on e.alocacao_id = a.id
    where a.item_id = p_item_id;
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
revoke all on function financeiro.sso_estornar_alocacao(uuid, uuid, uuid, integer, uuid, text)
  from public, anon, authenticated, service_role;

create function financeiro.sso_listar_alocacoes_faturavel(p_item_id uuid, p_apos uuid default null)
returns table(id uuid, documento_ref text, valor_centavos bigint, estornada boolean, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente from financeiro.itens_faturaveis where financeiro.itens_faturaveis.id = p_item_id;
  if v_cliente is null or config.sso_autorizar_acao('faturavel.efetivar', v_cliente) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return query select a.id, d.referencia, a.valor_centavos, e.id is not null, a.criado_em
    from financeiro.sso_faturavel_alocacoes a join financeiro.sso_faturavel_documentos d on d.id = a.documento_id
    left join financeiro.sso_faturavel_estornos e on e.alocacao_id = a.id
    where a.item_id = p_item_id and d.cliente_id = v_cliente and (p_apos is null or a.id > p_apos)
    order by a.id limit 20;
end;
$$;
revoke all on function financeiro.sso_listar_alocacoes_faturavel(uuid, uuid) from public, anon, authenticated, service_role;

-- Saldos consideram apenas alocações sem estorno lógico.
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
  select coalesce(sum(a.valor_centavos) filter (where e.id is null), 0) into v_total_item from financeiro.sso_faturavel_alocacoes a left join financeiro.sso_faturavel_estornos e on e.alocacao_id = a.id where a.item_id = p_item_id;
  select coalesce(sum(a.valor_centavos) filter (where e.id is null), 0) into v_total_documento from financeiro.sso_faturavel_alocacoes a left join financeiro.sso_faturavel_estornos e on e.alocacao_id = a.id where a.documento_id = v_documento.id;
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
revoke all on function financeiro.sso_alocar_faturavel_documento(uuid, uuid, uuid, integer, uuid, text, date, bigint)
  from public, anon, authenticated, service_role;


create or replace function financeiro.sso_saldo_faturavel(p_item_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_item financeiro.itens_faturaveis%rowtype; v_total numeric;
begin
  select * into v_item from financeiro.itens_faturaveis where id = p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar', v_item.cliente_id) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select coalesce(sum(a.valor_centavos) filter (where e.id is null), 0) into v_total from financeiro.sso_faturavel_alocacoes a left join financeiro.sso_faturavel_estornos e on e.alocacao_id = a.id where a.item_id = p_item_id;
  if v_item.valor_conferido_centavos is null or v_total > v_item.valor_conferido_centavos then
    raise exception 'saldo_indisponivel' using errcode = '23514'; end if;
  return (v_item.valor_conferido_centavos - v_total)::bigint;
end;
$$;
revoke all on function financeiro.sso_saldo_faturavel(uuid) from public, anon, authenticated, service_role;

-- Repasse localiza exclusivamente origem base, sem confundir complemento.
create or replace function financeiro.sso_declarar_repasse_despesa(
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
    where cliente_id = v_despesa.cliente_id and origem_tipo = 'despesa_visita' and origem_id = p_despesa_id and item_base_id is null
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


