# Tasks — E01-S170: Permissões por ação e governança configurável do programa

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** implementação em andamento.

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S170-governanca-plano/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S170_capacidades_sso.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S170 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S170-governanca-plano/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Configurar e aplicar capacidades atuais

**Independent Test:** Administrador atribui perfis acumuláveis e concessão individual; Operador tenta ação direta sem capacidade e acesso Cliente cruzado.

- [ ] T004 [US1] Escrever teste unitário falho para compor perfis/grupos existentes com capacidades e escopos, checar servidor com concessões atuais e refletir UI sem bypass por token antigo em `apps/web/src/features/pcm/domain/capacidades-sso-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/capacidades-sso-us1.test.ts` conforme `specs/E01-S170-governanca-plano/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar compor perfis/grupos existentes com capacidades e escopos, checar servidor com concessões atuais e refletir UI sem bypass por token antigo em `apps/web/src/features/pcm/domain/capacidades-sso.ts`, preservando constraints de `specs/E01-S170-governanca-plano/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/capacidades-sso.ts` e `apps/web/src/features/pcm/infrastructure/supabase-capacidades-sso-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/capacidades-sso-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/capacidades-sso/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Gerir Plano e validar execução conforme decisão do Fabrício

**Independent Test:** Planejador sem/com concessão individual tenta autoaprovar; supervisor autorizado valida OS e consulta auditoria.

- [ ] T009 [US2] Escrever teste unitário falho para aplicar gestão individual de Plano e autoaprovação aprovada, validação específica e trilha append-only de concessão/decisão em `apps/web/src/features/pcm/domain/capacidades-sso-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/capacidades-sso-us2.test.ts` conforme `specs/E01-S170-governanca-plano/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar aplicar gestão individual de Plano e autoaprovação aprovada, validação específica e trilha append-only de concessão/decisão em `apps/web/src/features/pcm/domain/capacidades-sso.ts`, preservando constraints de `specs/E01-S170-governanca-plano/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/capacidades-sso.ts` e `apps/web/src/features/pcm/infrastructure/supabase-capacidades-sso-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/capacidades-sso-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/capacidades-sso/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-capacidades-sso-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/capacidades-sso.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S170-governanca-plano/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S170-governanca-plano/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

Fatia iniciável isoladamente. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Identidades hardcoded; criar login técnico SSO; considerar escrita genérica como aprovação/validação automática.
