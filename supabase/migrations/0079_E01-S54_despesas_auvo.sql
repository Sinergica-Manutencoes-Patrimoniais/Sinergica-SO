-- 0079_E01-S54_despesas_auvo.sql
-- Reverso: DROP TABLE IF EXISTS pcm.despesas; DROP TABLE IF EXISTS pcm.despesa_tipos;

create table if not exists pcm.despesa_tipos (
  id uuid primary key default gen_random_uuid(), auvo_id bigint not null unique,
  nome text not null, auvo_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists pcm.despesas (
  id uuid primary key default gen_random_uuid(), auvo_id bigint not null unique,
  despesa_tipo_auvo_id bigint, funcionario_auvo_id bigint, auvo_task_id bigint,
  data date, valor_centavos integer, descricao text, auvo_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_despesas_task on pcm.despesas (auvo_task_id);
create index if not exists idx_despesas_data on pcm.despesas (data desc);
alter table pcm.despesa_tipos enable row level security; alter table pcm.despesa_tipos force row level security;
alter table pcm.despesas enable row level security; alter table pcm.despesas force row level security;
grant select on pcm.despesa_tipos, pcm.despesas to authenticated;
grant select, insert, update, delete on pcm.despesa_tipos, pcm.despesas to service_role;
create policy "despesa_tipos_select_pcm" on pcm.despesa_tipos for select to authenticated using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita'));
create policy "despesas_select_pcm" on pcm.despesas for select to authenticated using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita'));
