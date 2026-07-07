-- 0034_E01-S31_servicos.sql — Sinérgica SO
-- Serviços Auvo (`/services`): id Auvo é GUID/text e idempotência usa externalCode.
--
-- Reverso:
--   drop trigger if exists trg_servicos_auvo_enqueue on pcm.servicos;
--   drop table if exists pcm.servicos;

create table if not exists pcm.servicos (
  id                    uuid        primary key default gen_random_uuid(),
  titulo                text        not null,
  descricao             text,
  preco_centavos        int         not null check (preco_centavos >= 0),
  fiscal_service_id     text,
  ativo                 boolean     not null default true,
  auvo_id               text        unique,
  auvo_sync_status      text        not null default 'pending',
  auvo_sync_error       text,
  auvo_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz not null default now(),
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

create index if not exists idx_servicos_deleted_titulo
  on pcm.servicos (deleted_at, titulo);
create index if not exists idx_servicos_ativo
  on pcm.servicos (ativo);

alter table pcm.servicos enable row level security;
alter table pcm.servicos force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.servicos to authenticated;
grant select, insert, update, delete on pcm.servicos to service_role;

create policy "servicos_select" on pcm.servicos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "servicos_insert" on pcm.servicos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "servicos_update" on pcm.servicos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_servicos_auvo_enqueue
  after insert or update or delete on pcm.servicos
  for each row execute function pcm.fn_auvo_enqueue('servicos');
