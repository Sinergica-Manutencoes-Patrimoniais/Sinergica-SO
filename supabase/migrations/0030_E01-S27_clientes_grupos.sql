-- 0030_E01-S27_clientes_grupos.sql — Sinérgica SO
-- CRUD de Clientes via motor Auvo e catálogo de Grupos de Clientes (`/customergroups`).
--
-- Reverso:
--   drop trigger if exists trg_cliente_grupos_auvo_enqueue on pcm.cliente_grupos;
--   drop trigger if exists trg_clientes_auvo_enqueue on pcm.clientes;
--   drop table if exists pcm.cliente_grupos;
--   alter table pcm.clientes drop column if exists auvo_synced_at;
--   alter table pcm.clientes drop column if exists auvo_sync_error;
--   alter table pcm.clientes drop column if exists auvo_sync_status;

alter table pcm.clientes
  add column if not exists auvo_sync_status text not null default 'pending',
  add column if not exists auvo_sync_error text,
  add column if not exists auvo_synced_at timestamptz;

drop trigger if exists trg_clientes_auvo_enqueue on pcm.clientes;
create trigger trg_clientes_auvo_enqueue
  after insert or update or delete on pcm.clientes
  for each row execute function pcm.fn_auvo_enqueue('clientes');

create table if not exists pcm.cliente_grupos (
  id                    uuid        primary key default gen_random_uuid(),
  nome                  text        not null,
  cliente_ids           uuid[]      not null default '{}'::uuid[],
  clientes_auvo_ids     bigint[]    not null default '{}'::bigint[],
  auvo_id               bigint      unique,
  auvo_sync_status      text        not null default 'pending',
  auvo_sync_error       text,
  auvo_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz,
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

create index if not exists idx_cliente_grupos_deleted_nome
  on pcm.cliente_grupos (deleted_at, nome);
create index if not exists idx_cliente_grupos_cliente_ids
  on pcm.cliente_grupos using gin (cliente_ids);

alter table pcm.cliente_grupos enable row level security;
alter table pcm.cliente_grupos force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.cliente_grupos to authenticated;
grant select, insert, update, delete on pcm.cliente_grupos to service_role;

create policy "cliente_grupos_select" on pcm.cliente_grupos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "cliente_grupos_insert" on pcm.cliente_grupos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "cliente_grupos_update" on pcm.cliente_grupos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_cliente_grupos_auvo_enqueue
  after insert or update or delete on pcm.cliente_grupos
  for each row execute function pcm.fn_auvo_enqueue('cliente_grupos');
