-- 0190_E03-S07_contratos_comercial.sql — Sinérgica SO
-- Story E03-S07. `comercial.contratos` — o acordo fechado a partir da proposta aceita
-- (design.md §2.4). Dono é o Comercial (decisão 9 do PO); o Financeiro só recebe, por RPC
-- publicada, o plano de faturamento derivado (migration seguinte).
--
-- `unique(proposta_id)` é o AC-3 no banco — uma proposta gera no máximo um contrato. A RPC de
-- criação (migration 0192) checa antes e dá mensagem amigável; este `unique` é o cinto-e-suspensório
-- contra qualquer caminho que não passe pela RPC.
--
-- `dia_vencimento` não estava listado no design.md §2.4 original, mas é exigido por
-- `financeiro.contratos` (0106) pra virar plano de faturamento (AC-4) — nasce aqui porque quem edita
-- o contrato antes de ativar (AC-2: "todos editáveis antes de ativar") precisa poder escolhê-lo.
--
-- `valor_mensal_centavos` é NULLABLE: contrato `avulso` não gera plano de faturamento recorrente
-- (edge case da spec) — a RPC de ativação (0192) decide, não uma CHECK aqui (regra de negócio
-- condicional ao tipo é mais clara em PL/pgSQL do que em CHECK).
--
-- Reverso:
--   drop table if exists comercial.contratos;

create table comercial.contratos (
  id                      uuid        primary key default gen_random_uuid(),
  proposta_id             uuid        not null unique references comercial.propostas (id),
  cliente_id              uuid        not null references pcm.clientes (id),
  tipo                    text        not null check (tipo in ('residente', 'volante', 'avulso')),
  valor_mensal_centavos   integer     check (valor_mensal_centavos > 0),
  dia_vencimento          integer     not null default 5 check (dia_vencimento between 1 and 28),
  vigencia_inicio         date        not null,
  vigencia_fim            date,
  reajuste_indice         text,
  reajuste_mes            integer     check (reajuste_mes between 1 and 12),
  -- Sistemas cobertos, periodicidades (design.md §2.4) — estrutura livre, o PCM decide o que ler
  -- dela quando consumir o sinal do preventivo (fora de escopo desta story, R2 futura).
  escopo                  jsonb       not null default '[]'::jsonb,
  status                  text        not null default 'rascunho'
                                       check (status in ('rascunho', 'ativo', 'suspenso', 'encerrado')),
  encerrado_em            date,
  encerrado_motivo        text,
  -- FK opcional: só preenchida ao ativar (RPC 0192). `avulso` sem plano de faturamento fica nula
  -- mesmo depois de ativo — não é "ainda não ativou", é "este tipo não gera plano".
  financeiro_contrato_id  uuid        references financeiro.contratos (id),
  check (encerrado_em is null or status = 'encerrado'),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  created_at              timestamptz not null default now(),
  created_by              uuid        references auth.users,
  updated_at              timestamptz not null default now(),
  updated_by              uuid        references auth.users
);

create index idx_contratos_cliente_status on comercial.contratos (cliente_id, status);

alter table comercial.contratos enable row level security;
alter table comercial.contratos force row level security;

grant select, insert, update on comercial.contratos to authenticated;
grant select, insert, update, delete on comercial.contratos to service_role;

create policy "contratos_select" on comercial.contratos for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
);
create policy "contratos_insert" on comercial.contratos for insert to authenticated with check (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
);
create policy "contratos_update" on comercial.contratos for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

comment on table comercial.contratos is
  'E03-S07: contrato comercial gerado da proposta aceita (dono: Comercial, decisão 9 do PO). '
  'Ativar cria financeiro.contratos via RPC publicada (R1/R2, ADR-0019) — nunca insert direto.';
