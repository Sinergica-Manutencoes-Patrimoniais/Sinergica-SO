-- 0160_E02-S26_roteiro_entrevista.sql — Sinérgica SO
-- Story E02-S26. Base de dados do agente entrevistador de cadastro — roteiro configurável de
-- perguntas + estado de sessão de entrevista em andamento. Schema apenas; o motor conversacional
-- (edge function que conduz a entrevista via LLM e escreve o cadastro após confirmação) fica para
-- uma story de implementação própria — ver tasks.md SPEC_DEVIATION.
--
-- Reverso:
--   drop table if exists atendimento.entrevista_sessao;
--   drop table if exists atendimento.roteiro_entrevista;

create table atendimento.roteiro_entrevista (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null,
  ativo       boolean     not null default true,
  -- Array de perguntas: [{"campo":"cnpj","pergunta":"Qual o CNPJ?","obrigatorio":true}, ...]
  -- mesmo formato de `PassoFluxo` já usado pelo agente comercial (E02-S07/E02-S08), reaproveitado
  -- aqui pra não inventar um 2º formato de checklist configurável.
  perguntas   jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users
);

create table atendimento.entrevista_sessao (
  id            uuid        primary key default gen_random_uuid(),
  roteiro_id    uuid        not null references atendimento.roteiro_entrevista (id),
  cliente_id    uuid        references pcm.clientes (id),
  status        text        not null default 'em_andamento'
                             check (status in ('em_andamento', 'aguardando_confirmacao', 'confirmada', 'cancelada')),
  -- Respostas coletadas até agora + a proposta final (contato/CNPJ/estrutura) quando status vira
  -- 'aguardando_confirmacao' — mesmo padrão de `chamados_pendentes` (E02-S23): estado sobrevive
  -- entre mensagens/interações porque a entrevista acontece em múltiplos turnos.
  respostas     jsonb       not null default '{}'::jsonb,
  proposta      jsonb,
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users,
  updated_at    timestamptz not null default now()
);

create index idx_entrevista_sessao_roteiro on atendimento.entrevista_sessao (roteiro_id);
create index idx_entrevista_sessao_cliente on atendimento.entrevista_sessao (cliente_id);

alter table atendimento.roteiro_entrevista enable row level security;
alter table atendimento.roteiro_entrevista force row level security;
alter table atendimento.entrevista_sessao enable row level security;
alter table atendimento.entrevista_sessao force row level security;

grant select, insert, update, delete on atendimento.roteiro_entrevista to authenticated;
grant select, insert, update, delete on atendimento.roteiro_entrevista to service_role;
grant select, insert, update on atendimento.entrevista_sessao to authenticated;
grant select, insert, update, delete on atendimento.entrevista_sessao to service_role;

create policy "roteiro_entrevista_select" on atendimento.roteiro_entrevista for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "roteiro_entrevista_escrita" on atendimento.roteiro_entrevista for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "entrevista_sessao_select" on atendimento.entrevista_sessao for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "entrevista_sessao_insert" on atendimento.entrevista_sessao for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "entrevista_sessao_update" on atendimento.entrevista_sessao for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
