-- ADR-0175: gate fechado, nenhum lançamento é criado ou modificado.
create table financeiro.sso_faturamento_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table financeiro.sso_faturamento_gate enable row level security;
alter table financeiro.sso_faturamento_gate force row level security;
revoke all on financeiro.sso_faturamento_gate from public, anon, authenticated, service_role;
insert into financeiro.sso_faturamento_gate(id, habilitado) values (true, false);

alter table financeiro.itens_faturaveis drop constraint itens_faturaveis_status_check;
alter table financeiro.itens_faturaveis add constraint itens_faturaveis_status_check
  check (status in ('pendente', 'conferido', 'parcial', 'faturado', 'cancelado'));
create table financeiro.sso_faturavel_documentos (
  id uuid primary key default gen_random_uuid(), cliente_id uuid not null references pcm.clientes(id),
  referencia text not null check (length(btrim(referencia)) between 1 and 200),
  lancamento_id uuid not null unique references financeiro.lancamentos(id),
  data_documento date not null check (isfinite(data_documento)), criado_por uuid not null references config.usuarios(user_id),
  criado_em timestamptz not null default now(), unique(cliente_id, referencia)
);
create table financeiro.sso_faturavel_alocacoes (
  id uuid primary key, item_id uuid not null references financeiro.itens_faturaveis(id),
  documento_id uuid not null references financeiro.sso_faturavel_documentos(id),
  valor_centavos bigint not null check (valor_centavos between 1 and 9007199254740991),
  revisao_item integer not null check (revisao_item > 1), request_id uuid not null unique,
  ator_id uuid not null references config.usuarios(user_id), criado_em timestamptz not null default now(),
  unique(item_id, documento_id)
);
alter table financeiro.sso_faturavel_documentos enable row level security;
alter table financeiro.sso_faturavel_documentos force row level security;
alter table financeiro.sso_faturavel_alocacoes enable row level security;
alter table financeiro.sso_faturavel_alocacoes force row level security;
revoke all on financeiro.sso_faturavel_documentos, financeiro.sso_faturavel_alocacoes from public, anon, authenticated, service_role;

create function financeiro.sso_alocar_faturavel_documento(p_request_id uuid, p_alocacao_id uuid,
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
  select coalesce(sum(a.valor_centavos), 0) into v_total_item from financeiro.sso_faturavel_alocacoes a where a.item_id = p_item_id;
  select coalesce(sum(a.valor_centavos), 0) into v_total_documento from financeiro.sso_faturavel_alocacoes a where a.documento_id = v_documento.id;
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

create function financeiro.sso_lancamentos_para_faturavel(p_item_id uuid, p_apos uuid default null)
returns table(id uuid, descricao text, valor_centavos integer, competencia date, vencimento date)
language plpgsql stable security definer set search_path = '' as $$
declare v_item financeiro.itens_faturaveis%rowtype;
begin
  select * into v_item from financeiro.itens_faturaveis where financeiro.itens_faturaveis.id = p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar', v_item.cliente_id) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return query select l.id, l.descricao, l.valor_centavos, l.data_competencia, l.data_vencimento
    from financeiro.lancamentos l where l.tipo = 'entrada' and l.cliente_id = v_item.cliente_id
      and date_trunc('month', l.data_competencia)::date = v_item.competencia
      and (p_apos is null or l.id > p_apos) order by l.id limit 20;
end;
$$;
revoke all on function financeiro.sso_lancamentos_para_faturavel(uuid, uuid) from public, anon, authenticated, service_role;

create function financeiro.sso_saldo_faturavel(p_item_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_item financeiro.itens_faturaveis%rowtype; v_total numeric;
begin
  select * into v_item from financeiro.itens_faturaveis where id = p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar', v_item.cliente_id) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select coalesce(sum(valor_centavos), 0) into v_total from financeiro.sso_faturavel_alocacoes where item_id = p_item_id;
  if v_item.valor_conferido_centavos is null or v_total > v_item.valor_conferido_centavos then
    raise exception 'saldo_indisponivel' using errcode = '23514'; end if;
  return (v_item.valor_conferido_centavos - v_total)::bigint;
end;
$$;
revoke all on function financeiro.sso_saldo_faturavel(uuid) from public, anon, authenticated, service_role;
