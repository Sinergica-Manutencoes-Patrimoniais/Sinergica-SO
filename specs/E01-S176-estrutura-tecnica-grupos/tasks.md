# Tasks — E01-S176: Hierarquia técnica, Sistemas distribuídos e Grupos Quantitativos

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** implementação em andamento.

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S176-estrutura-tecnica-grupos/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S176_estrutura_tecnica.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S176 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S176-estrutura-tecnica-grupos/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Modelar ativos e grupos preservando estrutura

**Independent Test:** Montar VRF com condensadora/evaporadoras/componentes e grupo de 20 luminárias no salão; tentar ciclo e vínculo de outro Cliente.

- [ ] T004 [US1] Escrever teste unitário falho para estender parent_item_id com invariantes servidor e criar Grupo Quantitativo por Local sem recriar cadastros em `apps/web/src/features/pcm/domain/estrutura-tecnica-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/estrutura-tecnica-us1.test.ts` conforme `specs/E01-S176-estrutura-tecnica-grupos/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar estender parent_item_id com invariantes servidor e criar Grupo Quantitativo por Local sem recriar cadastros em `apps/web/src/features/pcm/domain/estrutura-tecnica.ts`, preservando constraints de `specs/E01-S176-estrutura-tecnica-grupos/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/estrutura-tecnica.ts` e `apps/web/src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/estrutura-tecnica-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/estrutura-tecnica/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Navegar por Sistema e por Local

**Independent Test:** Sistema de Extintores cobre vários halls; mover Componente e consultar Local 360, Sistema 360 e ativo.

- [ ] T009 [US2] Escrever teste unitário falho para compor read-models de Local/Sistema/ativo 360 com contexto físico/funcional sem inferir histórico inexistente em `apps/web/src/features/pcm/domain/estrutura-tecnica-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/estrutura-tecnica-us2.test.ts` conforme `specs/E01-S176-estrutura-tecnica-grupos/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar compor read-models de Local/Sistema/ativo 360 com contexto físico/funcional sem inferir histórico inexistente em `apps/web/src/features/pcm/domain/estrutura-tecnica.ts`, preservando constraints de `specs/E01-S176-estrutura-tecnica-grupos/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/estrutura-tecnica.ts` e `apps/web/src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/estrutura-tecnica-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/estrutura-tecnica/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/estrutura-tecnica.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S176-estrutura-tecnica-grupos/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S176-estrutura-tecnica-grupos/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S170 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Renomear tabela pcm.equipamentos; criar árvore física duplicada; forçar torre/pavimento como níveis rígidos; criar Equipment Auvo por luminária de Grupo.
