-- 0036_E01-S33_tickets.sql — Sinérgica SO
-- Tickets Auvo (`/tickets`): criação + mudança de status propagam; título/descrição só editáveis
-- localmente (API não documenta PATCH desses campos); sem DELETE documentado.
--
-- Reverso:
--   drop trigger if exists trg_tickets_auvo_enqueue on pcm.tickets;
--   drop table if exists pcm.tickets;

-- `cliente_auvo_id`/`equipe_auvo_id` são cópias denormalizadas de `pcm.clientes.auvo_id`/
-- `pcm.equipes.auvo_id`, preenchidas pela application ao criar/editar o ticket — o descriptor
-- (`toAuvo`, função pura sem acesso a banco) monta `customerId`/`teamId` direto da linha, sem
-- join, mesmo padrão de `pcm.cliente_grupos.clientes_auvo_ids` (E01-S27).
create table if not exists pcm.tickets (
  id                        uuid        primary key default gen_random_uuid(),
  titulo                    text        not null,
  descricao                 text,
  cliente_id                uuid        references pcm.clientes,
  cliente_auvo_id           bigint,
  equipe_id                 uuid        references pcm.equipes,
  equipe_auvo_id            bigint,
  responsavel_auvo_user_id  bigint,
  prioridade                int,
  request_type_id           int,
  status_id                 int,
  ativo                     boolean     not null default true,
  auvo_id                   bigint      unique,
  auvo_sync_status          text        not null default 'pending',
  auvo_sync_error           text,
  auvo_synced_at            timestamptz,
  created_at                timestamptz not null default now(),
  created_by                uuid        references auth.users,
  updated_at                timestamptz not null default now(),
  updated_by                uuid        references auth.users,
  deleted_at                timestamptz
);

create index if not exists idx_tickets_deleted_titulo
  on pcm.tickets (deleted_at, titulo);
create index if not exists idx_tickets_cliente
  on pcm.tickets (cliente_id);

alter table pcm.tickets enable row level security;
alter table pcm.tickets force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.tickets to authenticated;
grant select, insert, update, delete on pcm.tickets to service_role;

create policy "tickets_select" on pcm.tickets
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "tickets_insert" on pcm.tickets
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "tickets_update" on pcm.tickets
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_tickets_auvo_enqueue
  after insert or update or delete on pcm.tickets
  for each row execute function pcm.fn_auvo_enqueue('tickets');
