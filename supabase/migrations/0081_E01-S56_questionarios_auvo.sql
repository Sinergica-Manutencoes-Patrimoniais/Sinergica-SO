-- 0081_E01-S56_questionarios_auvo.sql
-- Reverso: DROP TABLE IF EXISTS pcm.questionarios;

create table if not exists pcm.questionarios (
  id uuid primary key default gen_random_uuid(), auvo_id bigint not null unique,
  nome text not null, cabecalho text, rodape text, perguntas jsonb not null default '[]'::jsonb,
  ativo boolean not null default true, auvo_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table pcm.questionarios enable row level security; alter table pcm.questionarios force row level security;
grant select on pcm.questionarios to authenticated;
grant select, insert, update, delete on pcm.questionarios to service_role;
create policy "questionarios_select_pcm" on pcm.questionarios for select to authenticated using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita'));
