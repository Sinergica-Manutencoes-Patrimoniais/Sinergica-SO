-- 0028_E01-S25_segmentos_palavras_chave.sql — Sinérgica SO
-- CRUD de Segmentos e Palavras-chave no PCM, sincronizados com Auvo `/segments` e `/keywords`.
--
-- Reverso:
--   drop trigger if exists trg_segmentos_auvo_enqueue on pcm.segmentos;
--   drop trigger if exists trg_palavras_chave_auvo_enqueue on pcm.palavras_chave;
--   drop table if exists pcm.palavras_chave;
--   drop table if exists pcm.segmentos;

create table if not exists pcm.segmentos (
  id                    uuid        primary key default gen_random_uuid(),
  descricao             text        not null,
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

create table if not exists pcm.palavras_chave (
  id                    uuid        primary key default gen_random_uuid(),
  descricao             text        not null,
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

create index if not exists idx_segmentos_deleted_descricao
  on pcm.segmentos (deleted_at, descricao);
create index if not exists idx_palavras_chave_deleted_descricao
  on pcm.palavras_chave (deleted_at, descricao);

alter table pcm.segmentos enable row level security;
alter table pcm.segmentos force row level security;
alter table pcm.palavras_chave enable row level security;
alter table pcm.palavras_chave force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.segmentos, pcm.palavras_chave to authenticated;
grant select, insert, update, delete on pcm.segmentos, pcm.palavras_chave to service_role;

create policy "segmentos_select" on pcm.segmentos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "segmentos_insert" on pcm.segmentos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "segmentos_update" on pcm.segmentos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "palavras_chave_select" on pcm.palavras_chave
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "palavras_chave_insert" on pcm.palavras_chave
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "palavras_chave_update" on pcm.palavras_chave
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_segmentos_auvo_enqueue
  after insert or update or delete on pcm.segmentos
  for each row execute function pcm.fn_auvo_enqueue('segmentos');

create trigger trg_palavras_chave_auvo_enqueue
  after insert or update or delete on pcm.palavras_chave
  for each row execute function pcm.fn_auvo_enqueue('palavras_chave');
