# Tasks — E01-S176: Hierarquia técnica, Sistemas distribuídos e Grupos Quantitativos

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** código, migrations e testes implementados; pgTAP integrado (21 assertions combinadas) e suíte web completa passaram. T016 permanece aberto para CI completa, E2E visual, revisão formal e homologação.

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S176-estrutura-tecnica-grupos/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [X] T002 Escrever testes pgTAP para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S176_isolamento_estrutura_1810.test.sql`, `supabase/tests/E01-S176_vinculos_cliente_final.test.sql` e `supabase/tests/E01-S176_membro_sistema_1819.test.sql`; executar permanece em T016 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [X] T003 Criar migrations aditivas E01-S176 em `supabase/migrations/`, incluindo hierarquia, grupos, leitura mediada, fotos, Planos por alvo e membro de Sistema; RLS FORCE, auditoria e revisões transacionais conforme data-model e ADRs (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Modelar ativos e grupos preservando estrutura

**Independent Test:** Montar VRF com condensadora/evaporadoras/componentes e grupo de 20 luminárias no salão; tentar ciclo e vínculo de outro Cliente.

- [X] T004 [US1] Escrever teste unitário para estender parent_item_id com invariantes servidor e criar Grupo Quantitativo por Local sem recriar cadastros em `apps/web/src/features/pcm/domain/estrutura-tecnica-us1.test.ts` (AC-1, AC-2, AC-3).
- [X] T005 [US1] Escrever testes de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/estrutura-tecnica-us1.test.ts` conforme `specs/E01-S176-estrutura-tecnica-grupos/contracts/commands.md` (AC-1, AC-2, AC-3).
- [X] T006 [US1] Implementar estender parent_item_id com invariantes servidor e criar Grupo Quantitativo por Local sem recriar cadastros em `apps/web/src/features/pcm/domain/estrutura-tecnica.ts` (AC-1, AC-2, AC-3).
- [X] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/estrutura-tecnica.ts` e `apps/web/src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.ts` (AC-1, AC-2, AC-3).
- [X] T008 [US1] Implementar consultas/invalidação e jornada US1 em `apps/web/src/features/pcm/application/estrutura-tecnica-queries.ts`, integradas à página `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx` e aos componentes `apps/web/src/features/pcm/interfaces/estrutura-tecnica/ComposicaoLocal.tsx` e `SistemasDistribuidos.tsx` (AC-1, AC-2, AC-3).

## Phase 4 — US2: Navegar por Sistema e por Local

**Independent Test:** Sistema de Extintores cobre vários halls; mover Componente e consultar Local 360, Sistema 360 e ativo.

- [X] T009 [US2] Escrever teste unitário para compor read-models de Local/Sistema/ativo 360 com contexto físico/funcional sem inferir histórico inexistente em `apps/web/src/features/pcm/domain/estrutura-tecnica-us2.test.ts` (AC-4, AC-5, AC-6).
- [X] T010 [US2] Escrever testes de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/estrutura-tecnica-us2.test.ts` conforme `specs/E01-S176-estrutura-tecnica-grupos/contracts/commands.md` (AC-4, AC-5, AC-6).
- [X] T011 [US2] Implementar compor read-models de Local/Sistema/ativo 360 com contexto físico/funcional sem inferir histórico inexistente em `apps/web/src/features/pcm/domain/estrutura-tecnica.ts` (AC-4, AC-5, AC-6).
- [X] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/estrutura-tecnica.ts` e `apps/web/src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.ts` (AC-4, AC-5, AC-6).
- [X] T013 [US2] Implementar consultas/invalidação e jornada US2 em `apps/web/src/features/pcm/application/estrutura-tecnica-queries.ts`, integradas à página `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx` e aos componentes `apps/web/src/features/pcm/interfaces/estrutura-tecnica/ComposicaoLocal.tsx`, `SistemasDistribuidos.tsx` e `DrawerDetalheSistema.tsx` (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [X] T014 Escrever teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.test.ts`; rollback e duas sessões concorrentes serão executados em T016 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [X] T015 Preparar jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/estrutura-tecnica.spec.ts`; a negação de UI é simulada, autorização real fica coberta por pgTAP. A validação global/Cliente360 e execução estão em T016 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S176-estrutura-tecnica-grupos/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6). Ver [registro integrado do lote](../../docs/planejamento/plano-manutencao/validacao-lote-s165-s166-s170-s176.md): suíte SQL local completa passou (225 arquivos/2.892 assertions); revisão adversarial local não encontrou achados reproduzidos. E2E, CI GitHub e homologação permanecem pendentes.
- [X] T017 Ajustar asserção E2E de criação de Área, ampliar prazo e diagnosticar autorização/etapa de timeout na criação de Grupo; execução integrada permanece em T016.

## Dependencies & Execution Order

E01-S170 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Renomear tabela pcm.equipamentos; criar árvore física duplicada; forçar torre/pavimento como níveis rígidos; criar Equipment Auvo por luminária de Grupo.
