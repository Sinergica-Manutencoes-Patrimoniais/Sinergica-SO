# Tasks — E01-S167: Chamado 1:N OS, continuidade e encerramento integral

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** todas tarefas de implementação pendentes; não executar nesta entrega documental.

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S167-chamados-os-visitas/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S167_chamados_os.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S167 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S167-chamados-os-visitas/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Dividir necessidade em várias OS rastreáveis

**Independent Test:** Criar um Chamado com três OS por comandos concorrentes distintos; retry de um comando não aumenta quantidade.

**SPEC_DEVIATION em avaliação:** ADR-0870 e migration 1057 preparam exceção restrita à rejeição de revisão obsoleta para o comando integral, somente quando todas as revisões intermediárias comprovadamente decorrerem de criações de OS. O contrato genérico ainda diz que revisão obsoleta gera conflito; reconciliar formalmente o contrato e concluir as provas/revisão antes de PASS ou rollout. Não altera os AC nem autoriza abertura dos gates.

- [ ] T004 [US1] Escrever teste unitário falho para trocar conversão única por criação N:1 idempotente, referência OS única e read-model de Chamado com várias OS sem cards duplicados em `apps/web/src/features/pcm/domain/chamados-os-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/chamados-os-us1.test.ts` conforme `specs/E01-S167-chamados-os-visitas/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar trocar conversão única por criação N:1 idempotente, referência OS única e read-model de Chamado com várias OS sem cards duplicados em `apps/web/src/features/pcm/domain/chamados-os.ts`, preservando constraints de `specs/E01-S167-chamados-os-visitas/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/chamados-os.ts` e `apps/web/src/features/pcm/infrastructure/supabase-chamados-os-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/chamados-os-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/chamados-os/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Continuar, suspender e encerrar sem perder escopo

**Independent Test:** Fechar duas de três OS, encerrar anterior parcial, criar continuação com 2 HH restantes e deixar parcela sem OS; tentar encerrar Chamado.

- [ ] T009 [US2] Escrever teste unitário falho para registrar escopo resolvido/restante, continuação com validação PCM, aptidão calculada e encerramento explícito com retorno de escopo em `apps/web/src/features/pcm/domain/chamados-os-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/chamados-os-us2.test.ts` conforme `specs/E01-S167-chamados-os-visitas/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar registrar escopo resolvido/restante, continuação com validação PCM, aptidão calculada e encerramento explícito com retorno de escopo em `apps/web/src/features/pcm/domain/chamados-os.ts`, preservando constraints de `specs/E01-S167-chamados-os-visitas/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/chamados-os.ts` e `apps/web/src/features/pcm/infrastructure/supabase-chamados-os-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/chamados-os-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/chamados-os/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-chamados-os-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/chamados-os.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S167-chamados-os-visitas/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S167-chamados-os-visitas/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S170 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Envio Auvo; Visita (E01-S171); criar Backlog como OS; renumerar legado.
