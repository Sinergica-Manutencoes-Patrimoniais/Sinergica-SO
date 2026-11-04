-- ADR-0119: fundação com RPCs fechadas; não cria fatos, documentos nem lançamentos.
create table financeiro.itens_faturaveis (
  id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  origem_tipo text not null check (origem_tipo ~ '^[a-z][a-z0-9_]{0,63}$'),
  origem_id uuid not null,
  valor_original_centavos bigint not null check (valor_original_centavos between 0 and 9007199254740991),
  valor_conferido_centavos bigint check (valor_conferido_centavos between 0 and 9007199254740991),
  competencia date not null check (extract(day from competencia) = 1),
  status text not null default 'pendente' check (status in ('pendente', 'conferido', 'cancelado')),
  revisao integer not null default 1 check (revisao > 0),
  criado_em timestamptz not null default now(),
  unique(cliente_id, origem_tipo, origem_id)
);
create table financeiro.sso_faturavel_eventos (
  item_id uuid not null references financeiro.itens_faturaveis(id),
  revisao integer not null check (revisao > 1),
  tipo text not null check (tipo in ('conferido', 'cancelado')),
  valor_anterior_centavos bigint not null,
  valor_final_centavos bigint,
  motivo text,
  ator_id uuid not null references config.usuarios(user_id),
  ocorrido_em timestamptz not null default now(),
  primary key (item_id, revisao)
);
create table financeiro.sso_faturavel_comandos (
  request_id uuid primary key, ator_id uuid not null references config.usuarios(user_id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table financeiro.itens_faturaveis enable row level security;
alter table financeiro.itens_faturaveis force row level security;
alter table financeiro.sso_faturavel_eventos enable row level security;
alter table financeiro.sso_faturavel_eventos force row level security;
alter table financeiro.sso_faturavel_comandos enable row level security;
alter table financeiro.sso_faturavel_comandos force row level security;
revoke all on financeiro.itens_faturaveis, financeiro.sso_faturavel_eventos, financeiro.sso_faturavel_comandos from public, anon, authenticated, service_role;

create function financeiro.sso_conferir_ou_cancelar_faturavel(
  p_request_id uuid, p_item_id uuid, p_expected_revision integer, p_acao text,
  p_valor_centavos bigint, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_item financeiro.itens_faturaveis%rowtype; v_ator uuid := auth.uid();
  v_comando financeiro.sso_faturavel_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_item_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_acao is null or p_acao not in ('conferir', 'cancelar')
    or (p_acao = 'conferir' and (p_valor_centavos is null or p_valor_centavos not between 0 and 9007199254740991))
    or (p_acao = 'cancelar' and p_valor_centavos is not null)
    or length(coalesce(p_motivo, '')) > 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_item from financeiro.itens_faturaveis where id = p_item_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar', v_item.cliente_id) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('itemId', p_item_id, 'expectedRevision', p_expected_revision,
    'acao', p_acao, 'valorCentavos', p_valor_centavos, 'motivo', p_motivo);
  select * into v_comando from financeiro.sso_faturavel_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_item.revisao <> p_expected_revision or v_item.status <> 'pendente' then
    raise exception 'revisao_ou_estado_invalido' using errcode = '40001';
  end if;
  if (p_acao = 'cancelar' or p_valor_centavos is distinct from v_item.valor_original_centavos)
    and length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_obrigatorio' using errcode = '22023';
  end if;
  update financeiro.itens_faturaveis set revisao = revisao + 1,
    status = case when p_acao = 'conferir' then 'conferido' else 'cancelado' end,
    valor_conferido_centavos = case when p_acao = 'conferir' then p_valor_centavos else null end
    where id = p_item_id returning * into v_item;
  insert into financeiro.sso_faturavel_eventos(item_id, revisao, tipo, valor_anterior_centavos, valor_final_centavos, motivo, ator_id)
    values (p_item_id, v_item.revisao, v_item.status, v_item.valor_original_centavos,
      v_item.valor_conferido_centavos, p_motivo, v_ator);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values(v_ator, 'faturavel.' || v_item.status, 'itens_faturaveis', p_item_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_item.cliente_id, 'revision', v_item.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_item_id, 'revision', v_item.revisao,
    'state', v_item.status, 'created', false, 'linkedIds', '{}'::jsonb, 'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into financeiro.sso_faturavel_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel(uuid, uuid, integer, text, bigint, text) from public, anon, authenticated, service_role;

create function financeiro.sso_listar_faturaveis_cliente(p_cliente_id uuid, p_limite integer, p_apos uuid default null)
returns table(id uuid, origem_tipo text, origem_id uuid, valor_original_centavos bigint,
  valor_conferido_centavos bigint, competencia date, status text, revisao integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('faturavel.efetivar', p_cliente_id) is not true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select f.id, f.origem_tipo, f.origem_id, f.valor_original_centavos,
    f.valor_conferido_centavos, f.competencia, f.status, f.revisao
    from financeiro.itens_faturaveis f where f.cliente_id = p_cliente_id and (p_apos is null or f.id > p_apos)
    order by f.id limit p_limite;
end;
$$;
revoke all on function financeiro.sso_listar_faturaveis_cliente(uuid, integer, uuid) from public, anon, authenticated, service_role;
