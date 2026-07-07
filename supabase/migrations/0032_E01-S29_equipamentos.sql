-- 0032_E01-S29_equipamentos.sql — Sinérgica SO
-- Promove o cache read-only de equipamentos (E01-S11) para `pcm.equipamentos`, editável pelo PCM,
-- preservando o Auvo como autoridade operacional conforme ADR-0006.
--
-- Reverso:
--   drop trigger if exists trg_equipamentos_auvo_enqueue on pcm.equipamentos;
--   drop table if exists pcm.equipamentos;

create table if not exists pcm.equipamentos (
  id                    uuid        primary key default gen_random_uuid(),
  auvo_equipment_id     bigint      unique,
  auvo_id               bigint      unique,
  nome                  text        not null,
  identificador         text,
  categoria             text,
  auvo_customer_id      bigint      references pcm.clientes (auvo_id),
  client_id             uuid        references pcm.clientes,
  localizacao           text,
  observacoes           text,
  ativo                 boolean     not null default true,
  auvo_sync_status      text        not null default 'pending',
  auvo_sync_error       text,
  auvo_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz not null default now(),
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

insert into pcm.equipamentos (
  id, auvo_equipment_id, auvo_id, nome, auvo_customer_id, client_id, ativo,
  auvo_sync_status, auvo_synced_at, created_at, updated_at
)
select
  e.id,
  e.auvo_equipment_id,
  e.auvo_equipment_id,
  e.nome,
  e.auvo_customer_id,
  c.id,
  e.ativo,
  'synced',
  e.updated_at,
  e.created_at,
  e.updated_at
from pcm.equipamentos_cache e
left join pcm.clientes c on c.auvo_id = e.auvo_customer_id
on conflict (auvo_equipment_id) do update
set
  auvo_id = excluded.auvo_id,
  nome = excluded.nome,
  auvo_customer_id = excluded.auvo_customer_id,
  client_id = excluded.client_id,
  ativo = excluded.ativo,
  updated_at = excluded.updated_at;

create index if not exists idx_equipamentos_deleted_nome
  on pcm.equipamentos (deleted_at, nome);
create index if not exists idx_equipamentos_cliente
  on pcm.equipamentos (client_id)
  where deleted_at is null;
create index if not exists idx_equipamentos_auvo_customer
  on pcm.equipamentos (auvo_customer_id)
  where deleted_at is null;
create index if not exists idx_equipamentos_ativo
  on pcm.equipamentos (ativo);

alter table pcm.equipamentos enable row level security;
alter table pcm.equipamentos force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.equipamentos to authenticated;
grant select, insert, update, delete on pcm.equipamentos to service_role;

create policy "equipamentos_select" on pcm.equipamentos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

-- ADR-0006: esta tabela é a promoção editável do cache read-only `pcm.equipamentos_cache`.
-- A escrita pelo PCM é deliberada: PCM origina cadastro/comando; Auvo segue autoridade operacional.
create policy "equipamentos_insert" on pcm.equipamentos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "equipamentos_update" on pcm.equipamentos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_equipamentos_auvo_enqueue
  after insert or update or delete on pcm.equipamentos
  for each row execute function pcm.fn_auvo_enqueue('equipamentos');
