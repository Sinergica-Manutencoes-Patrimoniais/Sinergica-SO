-- 0080_E01-S55_satisfacao_auvo.sql
-- Reverso: DROP TABLE IF EXISTS pcm.satisfacao_respostas;

create table if not exists pcm.satisfacao_respostas (
  id uuid primary key default gen_random_uuid(), auvo_id bigint not null unique,
  auvo_task_id bigint not null, pergunta text, resposta text, respondida_em timestamptz,
  score integer, email text, auvo_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_satisfacao_task on pcm.satisfacao_respostas (auvo_task_id);
alter table pcm.satisfacao_respostas enable row level security; alter table pcm.satisfacao_respostas force row level security;
grant select on pcm.satisfacao_respostas to authenticated;
grant select, insert, update, delete on pcm.satisfacao_respostas to service_role;
create policy "satisfacao_respostas_select_pcm" on pcm.satisfacao_respostas for select to authenticated using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita'));
