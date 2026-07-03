-- 0006_E00-S09_grupos_permissoes_modulo.sql — Sinérgica SO
-- Story E00-S09. Cria a fundação de grupos e permissões por módulo no schema config.
--
-- Reverso:
--   drop trigger if exists usuarios_grupo_xor_individual on config.usuarios;
--   drop trigger if exists usuario_modulos_xor_grupo on config.usuario_modulos;
--   drop function if exists config.assert_usuario_grupo_xor_individual();
--   drop function if exists config.assert_usuario_modulo_sem_grupo();
--   alter policy "usuarios_select" on config.usuarios
--     using (user_id = auth.uid() or auth.jwt() ->> 'user_role' = 'superadmin');
--   alter policy "usuarios_update" on config.usuarios
--     using (auth.jwt() ->> 'user_role' = 'superadmin')
--     with check (auth.jwt() ->> 'user_role' = 'superadmin');
--   alter table config.usuarios drop constraint if exists usuarios_grupo_id_fkey;
--   alter table config.usuarios drop column if exists grupo_id;
--   drop table if exists config.usuario_modulos;
--   drop table if exists config.grupo_modulos;
--   drop table if exists config.grupos;

-- ─────────────────────────── TABELAS DE PERMISSÃO ──────────────────────────

create table if not exists config.grupos (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null unique,
  descricao   text,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users (id),
  updated_at  timestamptz,
  updated_by  uuid        references auth.users (id)
);

create table if not exists config.grupo_modulos (
  grupo_id    uuid        not null references config.grupos (id) on delete cascade,
  modulo      text        not null,
  nivel       text        not null,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users (id),
  updated_at  timestamptz,
  updated_by  uuid        references auth.users (id),
  primary key (grupo_id, modulo),
  constraint grupo_modulos_modulo_check check (
    modulo in ('pcm', 'atendimento', 'comercial', 'financeiro', 'operacao', 'marketing', 'growth', 'gestao', 'area-cliente')
  ),
  constraint grupo_modulos_nivel_check check (nivel in ('leitura', 'escrita'))
);

create table if not exists config.usuario_modulos (
  user_id     uuid        not null references config.usuarios (user_id) on delete cascade,
  modulo      text        not null,
  nivel       text        not null,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users (id),
  updated_at  timestamptz,
  updated_by  uuid        references auth.users (id),
  primary key (user_id, modulo),
  constraint usuario_modulos_modulo_check check (
    modulo in ('pcm', 'atendimento', 'comercial', 'financeiro', 'operacao', 'marketing', 'growth', 'gestao', 'area-cliente')
  ),
  constraint usuario_modulos_nivel_check check (nivel in ('leitura', 'escrita'))
);

alter table config.usuarios
  add column if not exists grupo_id uuid;

alter table config.usuarios
  add constraint usuarios_grupo_id_fkey
  foreign key (grupo_id) references config.grupos (id) on delete set null not valid;

alter table config.grupos enable row level security;
alter table config.grupos force row level security;
alter table config.grupo_modulos enable row level security;
alter table config.grupo_modulos force row level security;
alter table config.usuario_modulos enable row level security;
alter table config.usuario_modulos force row level security;

grant select, insert, update on config.grupos, config.grupo_modulos, config.usuario_modulos to authenticated;

-- ─────────────────────────── RLS — CONFIG ADMIN ────────────────────────────

create policy "grupos_select" on config.grupos
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create policy "grupos_insert" on config.grupos
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create policy "grupos_update" on config.grupos
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create policy "grupo_modulos_select" on config.grupo_modulos
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create policy "grupo_modulos_insert" on config.grupo_modulos
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create policy "grupo_modulos_update" on config.grupo_modulos
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create policy "usuario_modulos_select" on config.usuario_modulos
  for select to authenticated
  using (
    user_id = auth.uid()
    or auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor')
  );

create policy "usuario_modulos_insert" on config.usuario_modulos
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create policy "usuario_modulos_update" on config.usuario_modulos
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "usuarios_select" on config.usuarios
  using (
    user_id = auth.uid()
    or auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor')
  );

alter policy "usuarios_update" on config.usuarios
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and papel <> 'superadmin')
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and papel <> 'superadmin')
  );

-- ─────────────────────────── EXCLUSIVIDADE GRUPO × INDIVIDUAL ──────────────

create or replace function config.assert_usuario_modulo_sem_grupo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from config.usuarios
     where user_id = new.user_id
       and grupo_id is not null
  ) then
    raise exception 'usuario_com_grupo_nao_pode_ter_permissao_individual'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function config.assert_usuario_grupo_xor_individual()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.grupo_id is not null and exists (
    select 1
      from config.usuario_modulos
     where user_id = new.user_id
  ) then
    raise exception 'usuario_com_permissao_individual_nao_pode_ter_grupo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger usuario_modulos_xor_grupo
  before insert or update on config.usuario_modulos
  for each row execute function config.assert_usuario_modulo_sem_grupo();

create trigger usuarios_grupo_xor_individual
  before insert or update of grupo_id on config.usuarios
  for each row execute function config.assert_usuario_grupo_xor_individual();
