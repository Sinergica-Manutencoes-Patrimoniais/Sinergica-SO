-- 0035_E01-S32_equipes.sql — Sinérgica SO
-- Equipes Auvo (`/teams`): API só cria/lê; updates/deletes no PCM são locais.
--
-- Reverso:
--   drop trigger if exists trg_equipes_auvo_enqueue on pcm.equipes;
--   drop table if exists pcm.equipes;

create table if not exists pcm.equipes (
  id                    uuid        primary key default gen_random_uuid(),
  nome                  text        not null,
  participantes_auvo_ids bigint[]   not null default '{}',
  gestores_auvo_ids     bigint[]    not null default '{}',
  ativo                 boolean     not null default true,
  auvo_id               bigint      unique,
  auvo_sync_status      text        not null default 'pending',
  auvo_sync_error       text,
  auvo_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz not null default now(),
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

create index if not exists idx_equipes_deleted_nome
  on pcm.equipes (deleted_at, nome);
create index if not exists idx_equipes_ativo
  on pcm.equipes (ativo);

alter table pcm.equipes enable row level security;
alter table pcm.equipes force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.equipes to authenticated;
grant select, insert, update, delete on pcm.equipes to service_role;

create policy "equipes_select" on pcm.equipes
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "equipes_insert" on pcm.equipes
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "equipes_update" on pcm.equipes
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_equipes_auvo_enqueue
  after insert or update or delete on pcm.equipes
  for each row execute function pcm.fn_auvo_enqueue('equipes');
