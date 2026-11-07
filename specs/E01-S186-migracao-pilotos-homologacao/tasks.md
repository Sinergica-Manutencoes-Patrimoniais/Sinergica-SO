# Tasks — E01-S186: Migração auditável, pilotos por ondas e homologação do programa

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** todas tarefas de implementação pendentes; não executar nesta entrega documental.

## Phase 1 — Setup

- [ ] T001 Revalidar dependências e reuso em `specs/E01-S186-migracao-pilotos-homologacao/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S186_migracao_programa.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S186 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S186-migracao-pilotos-homologacao/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Migrar por prévia e lotes reexecutáveis

**Independent Test:** Em base de teste, migrar planos para versão1, relações Chamado/OS, agenda e achados; reexecutar lote e reverter logicamente um sem uso posterior.

- [ ] T004 [US1] Escrever teste unitário falho para especificar e validar expand/backfill/conferência/reversão lógica em lote com mapping comprovado e compatibilidade legada em `apps/web/src/features/pcm/domain/migracao-programa-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/migracao-programa-us1.test.ts` conforme `specs/E01-S186-migracao-pilotos-homologacao/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar especificar e validar expand/backfill/conferência/reversão lógica em lote com mapping comprovado e compatibilidade legada em `apps/web/src/features/pcm/domain/migracao-programa.ts`, preservando constraints de `specs/E01-S186-migracao-pilotos-homologacao/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/migracao-programa.ts` e `apps/web/src/features/pcm/infrastructure/supabase-migracao-programa-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/migracao-programa-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/migracao-programa/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Homologar ondas sem declarar entrega antecipada

**Independent Test:** Executar CT001–030 em ambiente de teste e registrar ressalva; simular saída de onda recusada por evidência faltante.

- [ ] T009 [US2] Escrever teste unitário falho para montar matriz executável e runbook de seis ondas com evidências/aceites e gates de integração/segurança em `apps/web/src/features/pcm/domain/migracao-programa-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/migracao-programa-us2.test.ts` conforme `specs/E01-S186-migracao-pilotos-homologacao/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar montar matriz executável e runbook de seis ondas com evidências/aceites e gates de integração/segurança em `apps/web/src/features/pcm/domain/migracao-programa.ts`, preservando constraints de `specs/E01-S186-migracao-pilotos-homologacao/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/migracao-programa.ts` e `apps/web/src/features/pcm/infrastructure/supabase-migracao-programa-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/migracao-programa-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/migracao-programa/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-migracao-programa-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/migracao-programa.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S186-migracao-pilotos-homologacao/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S186-migracao-pilotos-homologacao/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S165, E01-S166, E01-S167, E01-S168, E01-S169, E01-S170, E01-S171, E01-S172, E01-S173, E01-S174, E01-S175, E01-S176, E01-S177, E01-S178, E01-S179, E01-S180, E01-S181, E01-S182, E01-S183, E01-S184, E01-S185 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Deploy ou migração real nesta etapa; reconstruir relatório histórico 14/10; desativar planilhas antes de aceite; importar todo histórico Auvo sem escopo.
