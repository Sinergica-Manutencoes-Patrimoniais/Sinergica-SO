-- 0155_E01-S104_agenda_tecnico.sql — Sinérgica SO
-- Story E01-S104. Board semanal de agenda do técnico — cadastro manual (1ª fase só visual, sem
-- alocação automática nem checagem de conflito). Coluna = dia; card = técnico + cliente/local.
--
-- Reverso:
--   drop table if exists pcm.agenda_tecnico;

create table pcm.agenda_tecnico (
  id                  uuid        primary key default gen_random_uuid(),
  funcionario_id      uuid        not null references pcm.funcionarios (id),
  cliente_id          uuid        not null references pcm.clientes (id),
  data                date        not null,
  hora                time,
  created_at          timestamptz not null default now(),
  created_by          uuid        references auth.users,
  updated_at          timestamptz not null default now(),
  updated_by          uuid        references auth.users,
  deleted_at          timestamptz
);

create index idx_agenda_tecnico_data on pcm.agenda_tecnico (data);
create index idx_agenda_tecnico_funcionario on pcm.agenda_tecnico (funcionario_id);

alter table pcm.agenda_tecnico enable row level security;
alter table pcm.agenda_tecnico force row level security;

grant select, insert, update, delete on pcm.agenda_tecnico to authenticated;
grant select, insert, update, delete on pcm.agenda_tecnico to service_role;

create policy "agenda_tecnico_select" on pcm.agenda_tecnico for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "agenda_tecnico_insert" on pcm.agenda_tecnico for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "agenda_tecnico_update" on pcm.agenda_tecnico for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "agenda_tecnico_delete" on pcm.agenda_tecnico for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
