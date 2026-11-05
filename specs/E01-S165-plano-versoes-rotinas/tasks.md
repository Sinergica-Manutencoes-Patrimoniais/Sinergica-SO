# Tasks — E01-S165: Plano multialvo, versões de Rotina e questionários referenciados

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** fundação isolada em andamento; dependências ainda não homologadas.

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S165-plano-versoes-rotinas/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S165_plano_manutencao.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).
- [ ] T003 Criar migration aditiva E01-S165 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S165-plano-versoes-rotinas/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).

## Phase 3 — US1: Elaborar Plano amplo sem efeito operacional

**Independent Test:** Criar Plano Guainumbí com Extintores, QGBT, VRF e Grupo Quantitativo; reabrir rascunho com três Rotinas distintas e nenhum registro de execução criado.

- [ ] T004 [US1] Escrever teste unitário falho para validar escopo multialvo do Plano e alvo exclusivo por versão de Rotina, rascunho, instrução/checklist obrigatório e tempo pendente em `apps/web/src/features/pcm/domain/plano-manutencao-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/plano-manutencao-us1.test.ts` conforme `specs/E01-S165-plano-versoes-rotinas/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar validar escopo multialvo do Plano e alvo exclusivo por versão de Rotina, rascunho, instrução/checklist obrigatório e tempo pendente em `apps/web/src/features/pcm/domain/plano-manutencao.ts`, preservando constraints de `specs/E01-S165-plano-versoes-rotinas/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/plano-manutencao.ts` e `apps/web/src/features/pcm/infrastructure/supabase-plano-manutencao-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/plano-manutencao-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/plano-manutencao/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Aprovar e revisar com histórico preservado

**Independent Test:** Aprovar, copiar modelo, alterar data-base e retirar escopo com efeito futuro; comparar versão e questionário usados por execução antiga.

- [ ] T009 [US2] Escrever teste unitário falho para aprovar por capacidade atual, versionar e congelar Rotinas/questionário aplicado, preservar histórico e produzir prévia de revisão/retirada/suspensão em `apps/web/src/features/pcm/domain/plano-manutencao-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6, AC-7).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/plano-manutencao-us2.test.ts` conforme `specs/E01-S165-plano-versoes-rotinas/contracts/commands.md` (AC-4, AC-5, AC-6, AC-7).
- [ ] T011 [US2] Implementar aprovar por capacidade atual, versionar e congelar Rotinas/questionário aplicado, preservar histórico e produzir prévia de revisão/retirada/suspensão em `apps/web/src/features/pcm/domain/plano-manutencao.ts`, preservando constraints de `specs/E01-S165-plano-versoes-rotinas/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6, AC-7).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/plano-manutencao.ts` e `apps/web/src/features/pcm/infrastructure/supabase-plano-manutencao-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6, AC-7).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/plano-manutencao-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/plano-manutencao/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6, AC-7).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-plano-manutencao-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/plano-manutencao.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S165-plano-versoes-rotinas/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).
- [ ] T016 Executar `specs/E01-S165-plano-versoes-rotinas/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).

## Dependencies & Execution Order

E01-S170, E01-S176 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Biblioteca/editoração/publicação de questionários própria e import/export Auvo sem contrato comprovado; geração externa; Copiloto completo.
