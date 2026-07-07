-- 0029_E01-S26_categorias.sql — Sinérgica SO
-- CRUD de Categorias de Produto e Equipamento no PCM, sincronizadas com Auvo
-- `/productcategories` e `/equipmentcategories`.
--
-- Reverso:
--   drop trigger if exists trg_produto_categorias_auvo_enqueue on pcm.produto_categorias;
--   drop trigger if exists trg_equipamento_categorias_auvo_enqueue on pcm.equipamento_categorias;
--   drop table if exists pcm.equipamento_categorias;
--   drop table if exists pcm.produto_categorias;

create table if not exists pcm.produto_categorias (
  id                    uuid        primary key default gen_random_uuid(),
  nome                  text        not null,
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

create table if not exists pcm.equipamento_categorias (
  id                    uuid        primary key default gen_random_uuid(),
  nome                  text        not null,
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

create index if not exists idx_produto_categorias_deleted_nome
  on pcm.produto_categorias (deleted_at, nome);
create index if not exists idx_equipamento_categorias_deleted_nome
  on pcm.equipamento_categorias (deleted_at, nome);

alter table pcm.produto_categorias enable row level security;
alter table pcm.produto_categorias force row level security;
alter table pcm.equipamento_categorias enable row level security;
alter table pcm.equipamento_categorias force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.produto_categorias, pcm.equipamento_categorias to authenticated;
grant select, insert, update, delete on pcm.produto_categorias, pcm.equipamento_categorias to service_role;

create policy "produto_categorias_select" on pcm.produto_categorias
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "produto_categorias_insert" on pcm.produto_categorias
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "produto_categorias_update" on pcm.produto_categorias
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "equipamento_categorias_select" on pcm.equipamento_categorias
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "equipamento_categorias_insert" on pcm.equipamento_categorias
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "equipamento_categorias_update" on pcm.equipamento_categorias
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_produto_categorias_auvo_enqueue
  after insert or update or delete on pcm.produto_categorias
  for each row execute function pcm.fn_auvo_enqueue('produto_categorias');

create trigger trg_equipamento_categorias_auvo_enqueue
  after insert or update or delete on pcm.equipamento_categorias
  for each row execute function pcm.fn_auvo_enqueue('equipamento_categorias');
