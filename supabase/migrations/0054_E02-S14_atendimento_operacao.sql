-- 0054_E02-S14_atendimento_operacao.sql — Sinérgica SO
-- Aba de config "Operação" (E02-S14, paridade heziomos `AgentOperationTab`, escopo reduzido ao AC
-- da story): motores (toggles) + regras de atendimento + orçamento em `atendimento.personas`;
-- lições aprendidas e especialistas em tabelas próprias (1:N por persona). Ferramentas de
-- tool-use/RAG reais (chamada de catálogo, busca por embedding) não existem neste projeto ainda —
-- os toggles aqui são a CONFIGURAÇÃO que o agente vai respeitar quando essa infra existir
-- (RAG real é E02-S15); não inventamos o motor, só o liga/desliga persistido.
--
-- Reverso:
--   drop table if exists atendimento.persona_especialistas;
--   drop table if exists atendimento.persona_licoes;
--   alter table atendimento.personas drop column if exists tool_use_enabled;
--   alter table atendimento.personas drop column if exists rag_enabled;
--   alter table atendimento.personas drop column if exists vendas_enabled;
--   alter table atendimento.personas drop column if exists consulta_pedidos_enabled;
--   alter table atendimento.personas drop column if exists limite_diario_mensagens;
--   alter table atendimento.personas drop column if exists transferir_apos_n_respostas;
--   alter table atendimento.personas drop column if exists palavras_transferencia;
--   alter table atendimento.personas drop column if exists orcamento_mensal_usd;

alter table atendimento.personas
  add column if not exists tool_use_enabled boolean not null default false,
  add column if not exists rag_enabled boolean not null default false,
  add column if not exists vendas_enabled boolean not null default false,
  add column if not exists consulta_pedidos_enabled boolean not null default false,
  add column if not exists limite_diario_mensagens int,
  add column if not exists transferir_apos_n_respostas int,
  add column if not exists palavras_transferencia text[] not null default '{}',
  add column if not exists orcamento_mensal_usd numeric(10, 2);

-- Modo vendas exige Ferramentas ligado (AC-1 da spec) — CHECK garante a invariante mesmo se a UI falhar.
alter table atendimento.personas drop constraint if exists personas_vendas_exige_tool_use;
alter table atendimento.personas add constraint personas_vendas_exige_tool_use
  check (not vendas_enabled or tool_use_enabled) not valid;

create table if not exists atendimento.persona_licoes (
  id                uuid        primary key default gen_random_uuid(),
  persona_id        uuid        not null references atendimento.personas(id),
  contexto          text        not null,
  resposta_errada   text        not null,
  resposta_certa    text        not null,
  ativo             boolean     not null default true,
  created_at        timestamptz not null default now(),
  created_by        uuid        references auth.users
);

create index if not exists idx_persona_licoes_persona
  on atendimento.persona_licoes (persona_id, ativo);

create table if not exists atendimento.persona_especialistas (
  id            uuid        primary key default gen_random_uuid(),
  persona_id    uuid        not null references atendimento.personas(id),
  nome          text        not null,
  quando_chamar text        not null,
  ativo         boolean     not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users
);

create index if not exists idx_persona_especialistas_persona
  on atendimento.persona_especialistas (persona_id, ativo);

alter table atendimento.persona_licoes        enable row level security;
alter table atendimento.persona_licoes        force row level security;
alter table atendimento.persona_especialistas enable row level security;
alter table atendimento.persona_especialistas force row level security;

grant select, insert, update on atendimento.persona_licoes, atendimento.persona_especialistas to authenticated;
grant select, insert, update, delete on atendimento.persona_licoes, atendimento.persona_especialistas to service_role;

create policy "persona_licoes_select" on atendimento.persona_licoes
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "persona_licoes_insert" on atendimento.persona_licoes
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "persona_licoes_update" on atendimento.persona_licoes
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "persona_especialistas_select" on atendimento.persona_especialistas
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "persona_especialistas_insert" on atendimento.persona_especialistas
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "persona_especialistas_update" on atendimento.persona_especialistas
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
