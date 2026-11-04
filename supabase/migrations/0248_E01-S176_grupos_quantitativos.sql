-- E01-S176: Grupo Quantitativo por Local existente, sem gerar equipamentos/Auvo (ADR-0032).
-- Reverso: desabilitar consumidores e preservar grupos, comandos e auditoria antes de retirar
-- objetos; nenhuma linha ou código legado é alterado por esta migration.
insert into config.sso_acoes(codigo, modulo, nivel, exige_concessao_individual) values
  ('cadastro.ler', 'pcm', 'leitura', false), ('cadastro.gerir', 'pcm', 'escrita', false)
on conflict (codigo) do nothing;
insert into config.sso_acao_modulos(acao, modulo, nivel) values
  ('cadastro.ler', 'pcm', 'leitura'), ('cadastro.gerir', 'pcm', 'escrita')
on conflict (acao, modulo) do nothing;

create table if not exists pcm.grupos_quantitativos (
  id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  local_id uuid not null references pcm.locais(id),
  categoria_id uuid not null references pcm.equipamento_categorias(id),
  sistema_id uuid references pcm.sistemas(id),
  nome text not null check (length(btrim(nome)) between 1 and 200),
  quantidade bigint not null check (quantidade between 1 and 9007199254740991),
  caracteristicas jsonb not null default '{}'::jsonb check (jsonb_typeof(caracteristicas) = 'object'),
  ativo boolean not null default true,
  revisao integer not null default 1 check (revisao > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz
);
create index if not exists idx_grupos_quantitativos_cliente_local
  on pcm.grupos_quantitativos(cliente_id, local_id, id) where deleted_at is null;
create index if not exists idx_grupos_quantitativos_sistema
  on pcm.grupos_quantitativos(sistema_id, id) where sistema_id is not null and deleted_at is null;
alter table pcm.grupos_quantitativos enable row level security;
alter table pcm.grupos_quantitativos force row level security;
grant select on pcm.grupos_quantitativos to authenticated;
create policy grupos_quantitativos_leitura on pcm.grupos_quantitativos for select to authenticated
  using (config.sso_autorizar_acao('cadastro.ler', cliente_id)
    or config.sso_autorizar_acao('cadastro.gerir', cliente_id));

create table if not exists pcm.estrutura_comandos (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  payload jsonb not null,
  resultado jsonb not null,
  created_at timestamptz not null default now()
);
alter table pcm.estrutura_comandos enable row level security;
alter table pcm.estrutura_comandos force row level security;

create or replace function pcm.sso_salvar_grupo_quantitativo(
  p_request_id uuid, p_expected_revision integer, p_grupo_id uuid, p_local_id uuid,
  p_categoria_id uuid, p_sistema_id uuid, p_nome text, p_quantidade bigint, p_caracteristicas jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_cliente_id uuid;
  v_nome text := nullif(btrim(p_nome), '');
  v_payload jsonb;
  v_comando pcm.estrutura_comandos%rowtype;
  v_anterior pcm.grupos_quantitativos%rowtype;
  v_atual pcm.grupos_quantitativos%rowtype;
  v_resultado jsonb;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_grupo_id is null or p_local_id is null or p_categoria_id is null
    or v_nome is null or length(v_nome) > 200 or p_quantidade is null
    or p_quantidade < 1 or p_quantidade > 9007199254740991
    or p_caracteristicas is null or jsonb_typeof(p_caracteristicas) <> 'object'
    or pg_column_size(p_caracteristicas) > 16384 then
    raise exception 'grupo_invalido' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_caracteristicas) e where jsonb_typeof(e.value) <> 'string') then
    raise exception 'caracteristicas_invalidas' using errcode = '22023';
  end if;
  select a.cliente_id into v_cliente_id from pcm.locais l
    join pcm.areas a on a.id = l.area_id
    where l.id = p_local_id and l.ativo and l.deleted_at is null and a.ativo and a.deleted_at is null;
  if v_cliente_id is null or not config.sso_autorizar_acao('cadastro.gerir', v_cliente_id) then
    raise exception 'local_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if not exists (select 1 from pcm.equipamento_categorias c where c.id = p_categoria_id and c.deleted_at is null) then
    raise exception 'categoria_indisponivel' using errcode = '22023';
  end if;
  if p_sistema_id is not null and not exists (select 1 from pcm.sistemas s where s.id = p_sistema_id
    and s.cliente_id = v_cliente_id and s.ativo and s.deleted_at is null) then
    raise exception 'sistema_invalido_ou_de_outro_cliente' using errcode = '23514';
  end if;
  v_payload := jsonb_build_object('tipo', 'grupoQuantitativo', 'expectedRevision', p_expected_revision,
    'grupoId', p_grupo_id, 'localId', p_local_id, 'categoriaId', p_categoria_id,
    'sistemaId', p_sistema_id, 'nome', v_nome, 'quantidade', p_quantidade, 'caracteristicas', p_caracteristicas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_comando from pcm.estrutura_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('grupo_quantitativo:' || p_grupo_id::text, 0));
  select * into v_anterior from pcm.grupos_quantitativos where id = p_grupo_id for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    insert into pcm.grupos_quantitativos(id, cliente_id, local_id, categoria_id, sistema_id, nome,
      quantidade, caracteristicas, created_by, updated_by)
      values (p_grupo_id, v_cliente_id, p_local_id, p_categoria_id, p_sistema_id, v_nome,
        p_quantidade, p_caracteristicas, v_actor, v_actor) returning * into v_atual;
  else
    if v_anterior.cliente_id is distinct from v_cliente_id then
      raise exception 'grupo_de_outro_cliente' using errcode = '23514';
    end if;
    if v_anterior.deleted_at is not null or not v_anterior.ativo then
      raise exception 'grupo_indisponivel' using errcode = '22023';
    end if;
    if v_anterior.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    update pcm.grupos_quantitativos set local_id = p_local_id, categoria_id = p_categoria_id,
      sistema_id = p_sistema_id, nome = v_nome, quantidade = p_quantidade,
      caracteristicas = p_caracteristicas, revisao = revisao + 1, updated_at = now(), updated_by = v_actor
      where id = p_grupo_id returning * into v_atual;
  end if;
  v_resultado := jsonb_build_object('aggregateId', v_atual.id, 'revision', v_atual.revisao,
    'state', v_atual.ativo, 'created', v_anterior.id is null,
    'linkedIds', jsonb_strip_nulls(jsonb_build_object('clienteId', v_cliente_id, 'localId', p_local_id, 'sistemaId', p_sistema_id)),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, case when v_anterior.id is null then 'grupo.criado' else 'grupo.atualizado' end,
      'grupos_quantitativos', p_grupo_id, jsonb_build_object('requestId', p_request_id,
        'antes', case when v_anterior.id is null then null else to_jsonb(v_anterior) end, 'depois', to_jsonb(v_atual)));
  insert into pcm.estrutura_comandos(request_id, actor_id, payload, resultado)
    values (p_request_id, v_actor, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_salvar_grupo_quantitativo(uuid, integer, uuid, uuid, uuid, uuid, text, bigint, jsonb) from public, anon;
grant execute on function pcm.sso_salvar_grupo_quantitativo(uuid, integer, uuid, uuid, uuid, uuid, text, bigint, jsonb) to authenticated;
