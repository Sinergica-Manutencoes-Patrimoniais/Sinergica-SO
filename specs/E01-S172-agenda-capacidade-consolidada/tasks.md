# Tasks — E01-S172: Agenda oficial e capacidade por técnico, Cliente e semana

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** todas tarefas de implementação pendentes; não executar nesta entrega documental.

## Phase 1 — Setup

- [ ] T001 Revalidar dependências e reuso em `specs/E01-S172-agenda-capacidade-consolidada/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S172_capacidade_agenda.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S172 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S172-agenda-capacidade-consolidada/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Comparar demanda e disponibilidade com mesma unidade

**Independent Test:** Simular 2h×2 técnicos×3 ocorrências, 12HH disponíveis, incluir 3HH e uma estimativa pendente; consultar por Cliente/técnico.

- [ ] T004 [US1] Escrever teste unitário falho para calcular HH interno/externo/restante e disponibilidade configurada com deduplicação e demanda incompleta em `apps/web/src/features/pcm/domain/capacidade-agenda-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/capacidade-agenda-us1.test.ts` conforme `specs/E01-S172-agenda-capacidade-consolidada/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar calcular HH interno/externo/restante e disponibilidade configurada com deduplicação e demanda incompleta em `apps/web/src/features/pcm/domain/capacidade-agenda.ts`, preservando constraints de `specs/E01-S172-agenda-capacidade-consolidada/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/capacidade-agenda.ts` e `apps/web/src/features/pcm/infrastructure/supabase-capacidade-agenda-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/capacidade-agenda-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/capacidade-agenda/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Planejar por alerta consciente

**Independent Test:** Planejar 10h em 8h, atividade de dois técnicos com só um disponível e conflito de agenda; confirmar justificativa e reprogramar.

- [ ] T009 [US2] Escrever teste unitário falho para expor agenda consolidada e simulação com alertas confirmáveis, simultaneidade e baseline de vencimentos em `apps/web/src/features/pcm/domain/capacidade-agenda-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/capacidade-agenda-us2.test.ts` conforme `specs/E01-S172-agenda-capacidade-consolidada/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar expor agenda consolidada e simulação com alertas confirmáveis, simultaneidade e baseline de vencimentos em `apps/web/src/features/pcm/domain/capacidade-agenda.ts`, preservando constraints de `specs/E01-S172-agenda-capacidade-consolidada/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/capacidade-agenda.ts` e `apps/web/src/features/pcm/infrastructure/supabase-capacidade-agenda-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/capacidade-agenda-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/capacidade-agenda/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-capacidade-agenda-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/capacidade-agenda.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S172-agenda-capacidade-consolidada/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S172-agenda-capacidade-consolidada/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S171 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Bloquear planejamento por excesso/especialidade nesta fase; inferir disponibilidade de toda jornada; somar OS e ocorrência duplicadamente.
