-- ADR-0147: preparação revogada, requer coordenação com transferências e relatórios.
create table pcm.despesa_visita_rateios (
  despesa_id uuid not null references pcm.despesas_visita(id),
  revisao integer not null check (revisao > 1),
  ator_id uuid not null references auth.users(id),
  request_id uuid not null unique,
  criado_em timestamptz not null default now(),
  primary key (despesa_id, revisao)
);
create table pcm.despesa_visita_rateio_parcelas (
  despesa_id uuid not null,
  revisao integer not null,
  vinculo_id uuid not null references pcm.visita_ordens_servico(id),
  valor_centavos bigint not null check (valor_centavos between 0 and 9007199254740991),
  primary key (despesa_id, revisao, vinculo_id),
  foreign key (despesa_id, revisao) references pcm.despesa_visita_rateios(despesa_id, revisao)
);
alter table pcm.despesa_visita_rateios enable row level security;
alter table pcm.despesa_visita_rateios force row level security;
alter table pcm.despesa_visita_rateio_parcelas enable row level security;
alter table pcm.despesa_visita_rateio_parcelas force row level security;
revoke all on pcm.despesa_visita_rateios, pcm.despesa_visita_rateio_parcelas
  from public, anon, authenticated, service_role;

create function pcm.sso_ratear_despesa_visita(p_request_id uuid, p_despesa_id uuid,
  p_expected_revision integer, p_parcelas jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_despesa pcm.despesas_visita%rowtype;
  v_comando pcm.despesa_visita_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
  v_total numeric; v_count integer; v_distintos integer; v_validos integer;
begin
  if v_actor is null or p_request_id is null or p_despesa_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_parcelas is null or jsonb_typeof(p_parcelas) <> 'array'
    or jsonb_array_length(p_parcelas) > 100 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p_parcelas) e where jsonb_typeof(e) <> 'object'
    or not (e ? 'vinculoId' and e ? 'valorCentavos') or (e - 'vinculoId' - 'valorCentavos') <> '{}'::jsonb
    or jsonb_typeof(e->'vinculoId') <> 'string' or jsonb_typeof(e->'valorCentavos') <> 'number'
    or e->>'vinculoId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or e->>'valorCentavos' !~ '^(0|[1-9][0-9]{0,15})$') then
    raise exception 'parcelas_invalidas' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('operacao', 'ratear', 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'parcelas', p_parcelas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_despesa.revisao <> p_expected_revision then raise exception 'revisao_divergente' using errcode = '40001'; end if;
  if v_despesa.status <> 'ativa' then raise exception 'estado_invalido' using errcode = '23514'; end if;
  select count(*), count(distinct (e->>'vinculoId')::uuid), coalesce(sum((e->>'valorCentavos')::numeric), 0)
    into v_count, v_distintos, v_total from jsonb_array_elements(p_parcelas) e;
  if v_count <> v_distintos or (v_count > 0 and v_total <> coalesce(v_despesa.realizado_centavos, v_despesa.previsto_centavos))
    or exists (select 1 from jsonb_array_elements(p_parcelas) e where (e->>'valorCentavos')::numeric > 9007199254740991)
    then raise exception 'rateio_invalido' using errcode = '23514'; end if;
  perform vo.id from pcm.visita_ordens_servico vo where vo.id in
    (select (e->>'vinculoId')::uuid from jsonb_array_elements(p_parcelas) e)
    order by vo.id for share;
  select count(*) into v_validos from pcm.visita_ordens_servico vo where vo.id in
    (select (e->>'vinculoId')::uuid from jsonb_array_elements(p_parcelas) e)
    and vo.visita_id = v_despesa.visita_id and vo.cliente_id = v_despesa.cliente_id and vo.encerrado_em is null;
  if v_validos <> v_count then raise exception 'vinculo_invalido' using errcode = '23514'; end if;
  update pcm.despesas_visita set revisao = revisao + 1 where id = p_despesa_id returning * into v_despesa;
  insert into pcm.despesa_visita_rateios(despesa_id, revisao, ator_id, request_id)
    values (p_despesa_id, v_despesa.revisao, v_actor, p_request_id);
  insert into pcm.despesa_visita_rateio_parcelas(despesa_id, revisao, vinculo_id, valor_centavos)
    select p_despesa_id, v_despesa.revisao, (e->>'vinculoId')::uuid, (e->>'valorCentavos')::bigint
    from jsonb_array_elements(p_parcelas) e;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'despesa_visita.rateada', 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id, 'revision', v_despesa.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', v_despesa.revisao,
    'state', 'ativa', 'created', false, 'linkedIds', jsonb_build_object('visitaId', v_despesa.visita_id),
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_despesa.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_ratear_despesa_visita(uuid, uuid, integer, jsonb)
  from public, anon, authenticated, service_role;

create function pcm.sso_consultar_rateio_despesa(p_despesa_id uuid)
returns table(revisao integer, vinculo_id uuid, os_id uuid, valor_centavos bigint, vinculo_vigente boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_revisao integer;
begin
  select d.cliente_id into v_cliente from pcm.despesas_visita d where d.id = p_despesa_id;
  if v_cliente is null or config.sso_autorizar_acao('despesa_visita.gerir', v_cliente) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select max(r.revisao) into v_revisao from pcm.despesa_visita_rateios r where r.despesa_id = p_despesa_id;
  return query select p.revisao, p.vinculo_id, vo.os_id, p.valor_centavos, vo.encerrado_em is null
    from pcm.despesa_visita_rateio_parcelas p
    join pcm.visita_ordens_servico vo on vo.id = p.vinculo_id
    where p.despesa_id = p_despesa_id and p.revisao = v_revisao order by p.vinculo_id;
end;
$$;
revoke all on function pcm.sso_consultar_rateio_despesa(uuid) from public, anon, authenticated, service_role;

create function pcm.sso_proteger_total_rateio() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_revisao integer; v_count bigint; v_total numeric;
begin
  select max(revisao) into v_revisao from pcm.despesa_visita_rateios where despesa_id = old.id;
  if v_revisao is null then return new; end if;
  select count(*), coalesce(sum(valor_centavos), 0) into v_count, v_total
    from pcm.despesa_visita_rateio_parcelas where despesa_id = old.id and revisao = v_revisao;
  if v_count > 0 and v_total <> coalesce(new.realizado_centavos, new.previsto_centavos) then
    raise exception 'rateio_incompativel_com_valor' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_total_rateio() from public, anon, authenticated, service_role;
create trigger s180_proteger_total_rateio before update of previsto_centavos, realizado_centavos
  on pcm.despesas_visita for each row execute function pcm.sso_proteger_total_rateio();
