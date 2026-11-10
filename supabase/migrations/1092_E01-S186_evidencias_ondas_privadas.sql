-- ADR-0931: preparação privada; não concede acesso nem registra aceite.
create table pcm.sso_evidencias_ondas_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_evidencias_ondas_gate(id, habilitado) values (true, false);

create table pcm.sso_ondas_homologacao (
  cliente_id uuid not null references pcm.clientes(id),
  onda smallint not null check (onda between 1 and 6),
  revisao integer not null default 0 check (revisao >= 0),
  primary key (cliente_id, onda)
);

create table pcm.sso_evidencias_ondas (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  cliente_id uuid not null,
  onda smallint not null,
  revisao integer not null check (revisao > 0),
  cenario text not null check (cenario ~ '^CT-(00[1-9]|0[12][0-9]|030)$'),
  versao text not null check (length(btrim(versao)) between 1 and 120),
  ambiente text not null check (length(btrim(ambiente)) between 1 and 120),
  executor_id uuid not null references auth.users(id),
  executado_em timestamptz not null,
  resultado text not null check (resultado in ('passou', 'falhou', 'bloqueado')),
  identificadores text[] not null check (cardinality(identificadores) between 1 and 50),
  artefatos text[] not null check (cardinality(artefatos) between 1 and 50),
  ressalva text not null check (length(ressalva) <= 2000),
  payload jsonb not null,
  criado_em timestamptz not null default now(),
  foreign key (cliente_id, onda) references pcm.sso_ondas_homologacao(cliente_id, onda),
  unique (cliente_id, onda, revisao)
);

alter table pcm.sso_evidencias_ondas_gate enable row level security;
alter table pcm.sso_evidencias_ondas_gate force row level security;
alter table pcm.sso_ondas_homologacao enable row level security;
alter table pcm.sso_ondas_homologacao force row level security;
alter table pcm.sso_evidencias_ondas enable row level security;
alter table pcm.sso_evidencias_ondas force row level security;
revoke all on pcm.sso_evidencias_ondas_gate, pcm.sso_ondas_homologacao, pcm.sso_evidencias_ondas from public, anon, authenticated, service_role;

create function pcm.sso_evidencia_onda_imutavel() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'evidencia_imutavel' using errcode = '23514';
end;
$$;
revoke all on function pcm.sso_evidencia_onda_imutavel() from public, anon, authenticated, service_role;
create trigger sso_evidencia_onda_imutavel before update or delete on pcm.sso_evidencias_ondas
for each row execute function pcm.sso_evidencia_onda_imutavel();

create function pcm.sso_registrar_evidencia_onda(
  p_request_id uuid, p_cliente_id uuid, p_onda smallint, p_expected_revision integer,
  p_cenario text, p_versao text, p_ambiente text, p_executado_em timestamptz,
  p_resultado text, p_identificadores text[], p_artefatos text[], p_ressalva text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_payload jsonb;
  v_anterior pcm.sso_evidencias_ondas%rowtype;
  v_revisao integer;
  v_id uuid;
  v_saida jsonb;
  v_habilitado boolean;
begin
  select habilitado into v_habilitado from pcm.sso_evidencias_ondas_gate where id for share;
  if not coalesce(v_habilitado, false) then
    raise exception 'evidencias_desabilitadas' using errcode = '55000';
  end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_onda is null or p_onda not between 1 and 6
    or p_expected_revision is null or p_expected_revision < 0
    or p_cenario is null or p_cenario !~ '^CT-(00[1-9]|0[12][0-9]|030)$'
    or p_versao is null or length(btrim(p_versao)) not between 1 and 120
    or p_ambiente is null or length(btrim(p_ambiente)) not between 1 and 120
    or p_executado_em is null or p_resultado is null or p_resultado not in ('passou', 'falhou', 'bloqueado')
    or p_ressalva is null or length(p_ressalva) > 2000
    or p_identificadores is null or cardinality(p_identificadores) not between 1 and 50
    or p_artefatos is null or cardinality(p_artefatos) not between 1 and 50
    or exists (select 1 from unnest(p_identificadores || p_artefatos) as item(valor)
      where valor is null or length(valor) not between 1 and 200 or valor !~ '^[A-Za-z0-9_.:-]+$') then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'onda', p_onda, 'expectedRevision', p_expected_revision,
    'cenario', p_cenario, 'versao', btrim(p_versao), 'ambiente', btrim(p_ambiente), 'executadoEmEpoch', extract(epoch from p_executado_em),
    'resultado', p_resultado, 'identificadores', p_identificadores, 'artefatos', p_artefatos, 'ressalva', p_ressalva);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evidencia-onda:' || p_request_id::text, 0));
  select * into v_anterior from pcm.sso_evidencias_ondas where request_id = p_request_id;
  if found then
    if v_anterior.executor_id is distinct from v_ator or v_anterior.cliente_id is distinct from p_cliente_id then
      raise exception 'sem_acesso' using errcode = '42501';
    end if;
    if v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return jsonb_build_object('id', v_anterior.id, 'clienteId', v_anterior.cliente_id,
      'onda', v_anterior.onda, 'revision', v_anterior.revisao, 'requestId', p_request_id);
  end if;
  insert into pcm.sso_ondas_homologacao(cliente_id, onda) values (p_cliente_id, p_onda) on conflict do nothing;
  select revisao into v_revisao from pcm.sso_ondas_homologacao where cliente_id = p_cliente_id and onda = p_onda for update;
  if v_revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if not coalesce((select habilitado from pcm.sso_evidencias_ondas_gate where id), false)
    or config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  update pcm.sso_ondas_homologacao set revisao = revisao + 1 where cliente_id = p_cliente_id and onda = p_onda returning revisao into v_revisao;
  insert into pcm.sso_evidencias_ondas(request_id, cliente_id, onda, revisao, cenario, versao, ambiente,
    executor_id, executado_em, resultado, identificadores, artefatos, ressalva, payload)
  values (p_request_id, p_cliente_id, p_onda, v_revisao, p_cenario, btrim(p_versao), btrim(p_ambiente),
    v_ator, p_executado_em, p_resultado, p_identificadores, p_artefatos, p_ressalva, v_payload) returning id into v_id;
  v_saida := jsonb_build_object('id', v_id, 'clienteId', p_cliente_id, 'onda', p_onda, 'revision', v_revisao, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
  values (v_ator, 'homologacao.evidencia_registrada', 'sso_evidencias_ondas', v_id, v_saida);
  return v_saida;
end;
$$;
revoke all on function pcm.sso_registrar_evidencia_onda(uuid,uuid,smallint,integer,text,text,text,timestamptz,text,text[],text[],text)
  from public, anon, authenticated, service_role;
