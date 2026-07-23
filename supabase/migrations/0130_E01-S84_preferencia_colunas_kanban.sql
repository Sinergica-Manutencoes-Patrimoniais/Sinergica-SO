-- 0130_E01-S84_preferencia_colunas_kanban.sql — Sinérgica SO
-- Story E01-S84. Kanban de OS: colunas customizáveis (ordem + ocultar), preferência por usuário.

create table config.preferencia_colunas_kanban_os (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  colunas    jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table config.preferencia_colunas_kanban_os enable row level security;
alter table config.preferencia_colunas_kanban_os force row level security;

grant select, insert, update, delete on config.preferencia_colunas_kanban_os to authenticated;
grant select, insert, update, delete on config.preferencia_colunas_kanban_os to service_role;

create policy "preferencia_colunas_kanban_os_dono" on config.preferencia_colunas_kanban_os
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
