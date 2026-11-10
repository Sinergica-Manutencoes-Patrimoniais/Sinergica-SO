-- ADR-0102: fundação aditiva. Não ativar antes de revisão de segurança e testes integrados.
-- Categorias existentes são reaproveitadas sem criar registros Auvo; avaliar cobertura do catálogo.
insert into config.sso_acoes(codigo, modulo, nivel, exige_concessao_individual)
values ('despesa_visita.gerir', 'pcm', 'escrita', false)
on conflict (codigo) do nothing;

create table pcm.despesas_visita (
  id uuid primary key,
  visita_id uuid not null,
  cliente_id uuid not null,
  categoria_id uuid not null references pcm.despesa_tipos(id),
  data date not null check (isfinite(data)),
  descricao text not null check (length(btrim(descricao)) between 1 and 10000),
  previsto_centavos bigint not null check (previsto_centavos between 0 and 9007199254740991),
  realizado_centavos bigint check (realizado_centavos between 0 and 9007199254740991),
  status text not null default 'ativa' check (status in ('ativa', 'cancelada')),
  revisao integer not null default 1 check (revisao > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (visita_id, cliente_id) references pcm.visitas(id, cliente_id)
);
create index idx_despesas_visita_cliente_data on pcm.despesas_visita(cliente_id, data desc, id);
alter table pcm.despesas_visita enable row level security;
alter table pcm.despesas_visita force row level security;
revoke all on pcm.despesas_visita from public, anon, authenticated, service_role;
grant select on pcm.despesas_visita to authenticated;
create policy despesas_visita_leitura on pcm.despesas_visita for select to authenticated
  using (config.sso_autorizar_acao('despesa_visita.gerir', cliente_id));

create table pcm.despesa_visita_comandos (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null,
  resultado jsonb not null,
  created_at timestamptz not null default now()
);
alter table pcm.despesa_visita_comandos enable row level security;
alter table pcm.despesa_visita_comandos force row level security;
revoke all on pcm.despesa_visita_comandos from public, anon, authenticated, service_role;

-- Comprovantes, alteração, rateio e cancelamento não são habilitados nesta fundação:
-- seus contratos de propriedade e financeiro ainda não foram verificados.
create function pcm.sso_criar_despesa_visita(
  p_request_id uuid, p_despesa_id uuid, p_visita_id uuid, p_categoria_id uuid,
  p_data date, p_descricao text, p_previsto_centavos bigint, p_realizado_centavos bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_cliente uuid;
  v_payload jsonb;
  v_resultado jsonb;
  v_comando pcm.despesa_visita_comandos%rowtype;
begin
  if v_actor is null or p_request_id is null or p_despesa_id is null or p_visita_id is null
    or p_categoria_id is null or p_data is null or not isfinite(p_data)
    or p_descricao is null or length(btrim(p_descricao)) not between 1 and 10000
    or p_previsto_centavos is null or p_previsto_centavos not between 0 and 9007199254740991
    or (p_realizado_centavos is not null and p_realizado_centavos not between 0 and 9007199254740991) then
    raise exception 'despesa_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('despesaId', p_despesa_id, 'visitaId', p_visita_id,
    'categoriaId', p_categoria_id, 'data', p_data, 'descricao', btrim(p_descricao),
    'previstoCentavos', p_previsto_centavos, 'realizadoCentavos', p_realizado_centavos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('despesa_visita.gerir', v_comando.cliente_id) then
      raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  select cliente_id into v_cliente from pcm.visitas where id = p_visita_id for share;
  if v_cliente is null or not config.sso_autorizar_acao('despesa_visita.gerir', v_cliente) then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  insert into pcm.despesas_visita(id, visita_id, cliente_id, categoria_id, data, descricao,
    previsto_centavos, realizado_centavos, created_by)
    values (p_despesa_id, p_visita_id, v_cliente, p_categoria_id, p_data, btrim(p_descricao),
      p_previsto_centavos, p_realizado_centavos, v_actor);
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', 1, 'state', 'ativa',
    'created', true, 'linkedIds', jsonb_build_object('visitaId', p_visita_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'despesa_visita.criada', 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'revision', 1));
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_cliente, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_criar_despesa_visita(uuid, uuid, uuid, uuid, date, text, bigint, bigint) from public, anon, service_role;
grant execute on function pcm.sso_criar_despesa_visita(uuid, uuid, uuid, uuid, date, text, bigint, bigint) to authenticated;
