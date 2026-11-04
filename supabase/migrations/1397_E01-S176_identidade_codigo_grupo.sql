-- ADR-1244: fundação privada; não conecta escritores nem habilita incorporação.
create table pcm.sso_codigos_grupo_quantitativo (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references pcm.grupos_quantitativos(id),
  cliente_id uuid not null references pcm.clientes(id),
  codigo text not null check (length(codigo) between 1 and 200 and codigo = upper(codigo) and codigo !~ '[[:space:]]'),
  atual boolean not null default true,
  request_id uuid not null unique,
  ator_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);
create unique index sso_codigos_grupo_codigo_unico on pcm.sso_codigos_grupo_quantitativo (upper(btrim(codigo)));
create unique index sso_codigos_grupo_atual_unico on pcm.sso_codigos_grupo_quantitativo (grupo_id) where atual;
alter table pcm.sso_codigos_grupo_quantitativo enable row level security;
alter table pcm.sso_codigos_grupo_quantitativo force row level security;
revoke all on pcm.sso_codigos_grupo_quantitativo from public, anon, authenticated, service_role;

create function pcm.sso_atribuir_codigo_inicial_grupo_privado(p_request_id uuid, p_grupo_id uuid, p_codigo text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_cliente uuid;
  v_anterior pcm.sso_codigos_grupo_quantitativo%rowtype;
  v_id uuid;
begin
  if v_ator is null or p_request_id is null or p_grupo_id is null or p_codigo is null
    or length(p_codigo) not between 1 and 200 or p_codigo <> upper(p_codigo)
    or p_codigo ~ '[[:space:]]' then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  select cliente_id into v_cliente from pcm.grupos_quantitativos
    where id = p_grupo_id and ativo and deleted_at is null for update;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar', v_cliente) is not true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  -- A linha do Grupo já está travada; não esperar pela trava global evita
  -- inversão com comandos que adquirem a trava global antes da linha.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then
    raise exception 'codigo_concorrente_tente_novamente' using errcode = '40001';
  end if;
  select * into v_anterior from pcm.sso_codigos_grupo_quantitativo where request_id = p_request_id;
  if found then
    if v_anterior.grupo_id is distinct from p_grupo_id or v_anterior.cliente_id is distinct from v_cliente
      or v_anterior.ator_id is distinct from v_ator or v_anterior.codigo is distinct from p_codigo then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_anterior.id;
  end if;
  if exists (select 1 from pcm.sso_codigos_grupo_quantitativo where grupo_id = p_grupo_id and atual)
    or exists (select 1 from pcm.sso_codigos_grupo_quantitativo where upper(btrim(codigo)) = p_codigo)
    or exists (select 1 from pcm.sistemas where upper(btrim(codigo)) = p_codigo)
    or exists (select 1 from pcm.equipamentos where upper(btrim(identificador)) = p_codigo)
    or exists (select 1 from pcm.sso_codigo_aliases where upper(btrim(codigo)) = p_codigo)
    or (exists (select 1 from pcm.sso_reservas_codigo_parcial where consumida_em is null and liberada_em is null and upper(btrim(codigo)) = p_codigo)
      and not exists (select 1 from pcm.sso_reserva_codigo_permissao p where p.txid = pg_catalog.txid_current() and p.ator_id = v_ator and upper(btrim(p.codigo)) = p_codigo)) then
    raise exception 'codigo_indisponivel' using errcode = '23505';
  end if;
  insert into pcm.sso_codigos_grupo_quantitativo(grupo_id, cliente_id, codigo, request_id, ator_id)
    values (p_grupo_id, v_cliente, p_codigo, p_request_id, v_ator) returning id into v_id;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'grupo.codigo_inicial', 'grupos_quantitativos', p_grupo_id,
      jsonb_build_object('clienteId', v_cliente, 'requestId', p_request_id, 'codigo', p_codigo));
  return v_id;
end $$;
revoke all on function pcm.sso_atribuir_codigo_inicial_grupo_privado(uuid, uuid, text) from public, anon, authenticated, service_role;
