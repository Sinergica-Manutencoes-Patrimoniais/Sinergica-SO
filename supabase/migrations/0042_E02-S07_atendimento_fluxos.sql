-- 0042_E02-S07_atendimento_fluxos.sql — Sinérgica SO
-- Fluxo de qualificação visual (E02-S07), editado com @xyflow/react no frontend. Cada fluxo
-- pertence a uma persona (`atendimento.personas`, E02-S06) — hoje só a persona 'comercial' usa
-- isso de verdade (E02-S08); o Zé ('chamados') continua com extração livre via prompt, sem
-- checklist estruturado. `definicao` guarda o array de passos como jsonb (id/campo/pergunta/
-- obrigatorio/ordem/x/y — x/y são só a posição visual do nó no canvas, não afetam a execução)
-- em vez de uma tabela normalizada de passos: o editor visual sempre lê/escreve a lista inteira de
-- uma vez (sem edição concorrente de passo individual), então normalizar não traria benefício de
-- integridade real e complicaria o adapter.
--
-- Reverso:
--   drop table if exists atendimento.fluxos;

create table if not exists atendimento.fluxos (
  id         uuid        primary key default gen_random_uuid(),
  persona_id uuid        not null references atendimento.personas(id),
  nome       text        not null,
  definicao  jsonb       not null default '[]'::jsonb,
  ativo      boolean     not null default true,
  created_at timestamptz not null default now(),
  created_by uuid        references auth.users,
  updated_at timestamptz,
  updated_by uuid        references auth.users
);

create index if not exists idx_atendimento_fluxos_persona_ativo
  on atendimento.fluxos (persona_id, ativo);

alter table atendimento.fluxos enable row level security;
alter table atendimento.fluxos force row level security;

grant usage on schema atendimento to authenticated, service_role;
grant select, insert, update on atendimento.fluxos to authenticated;
grant select, insert, update, delete on atendimento.fluxos to service_role;

create policy "atendimento_fluxos_select" on atendimento.fluxos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "atendimento_fluxos_insert" on atendimento.fluxos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "atendimento_fluxos_update" on atendimento.fluxos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
