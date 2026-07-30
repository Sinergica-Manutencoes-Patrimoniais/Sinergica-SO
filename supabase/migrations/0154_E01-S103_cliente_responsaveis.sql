-- 0154_E01-S103_cliente_responsaveis.sql — Sinérgica SO
-- Story E01-S103. Responsável/representante do cliente (síndico, gerente predial, etc.) — pode
-- haver mais de um por cliente. Distinto de `contacts` sincronizado do Auvo (read-only,
-- `PainelContatos` em VisaoClientePage.tsx): este é cadastro local, editável no PCM, usado também
-- como insumo futuro pro Zé saber quem pode solicitar abertura de chamado (E02-S23/S24).
--
-- Reverso:
--   drop table if exists pcm.cliente_responsaveis;

create table pcm.cliente_responsaveis (
  id           uuid        primary key default gen_random_uuid(),
  cliente_id   uuid        not null references pcm.clientes (id),
  nome         text        not null,
  papel        text,
  contato      text,
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users,
  updated_at   timestamptz not null default now(),
  updated_by   uuid        references auth.users,
  deleted_at   timestamptz
);

create index idx_cliente_responsaveis_cliente on pcm.cliente_responsaveis (cliente_id);

alter table pcm.cliente_responsaveis enable row level security;
alter table pcm.cliente_responsaveis force row level security;

grant select, insert, update, delete on pcm.cliente_responsaveis to authenticated;
grant select, insert, update, delete on pcm.cliente_responsaveis to service_role;

create policy "cliente_responsaveis_select" on pcm.cliente_responsaveis for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "cliente_responsaveis_insert" on pcm.cliente_responsaveis for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "cliente_responsaveis_update" on pcm.cliente_responsaveis for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "cliente_responsaveis_delete" on pcm.cliente_responsaveis for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
