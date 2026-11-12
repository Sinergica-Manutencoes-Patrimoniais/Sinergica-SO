# Tasks — E01-S179: Central de Materiais, parser determinístico e exceções de campo

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status** (auditoria de código em 2026-11-10, madrugada): **story essencialmente pronta**, tasks.md estava desatualizado. Realidade: **29 migrations** (0322→1558), **24 arquivos TS/TSX (2123 linhas)** em `interfaces/listas-materiais/` (Workspace, Central, EditorMateriais, EditorPersistido, DisponibilidadeMateriais, ExcecoesOs, ObservacoesExcecao, EvidenciasExcecao, ImpedimentoMaterialOs, HistoricoVersoes, DetalheEvento, PublicarPortal, VisibilidadePortal), todos com teste colocado.
- **AC-1/2/3** (US1 — lista/parser/Central): REAL-E-TESTADO. `domain/listas-materiais.ts` + `listas-materiais-us1.test.ts` (5 testes). Vitest de dentro de `apps/web/`: **7 arquivos, 22 testes, todos passando**. pgTAP: `E01-S179_central_mediada`(10), `_criacao_mediada`(11), `_edicao_mediada`(9), `_eventos_mediados`(10), `_listagem_os_mediada`(9) = 49 assertions, seleção oficial `db-tests`.
- **AC-4/5/6** (US2 — disponibilidade/exceção/impedimento): código REAL (`sso_declarar_impedimento_material_os` retorna `efeitoRemoto:false,osAlterada:false`, confirma "preserva tarefa Auvo"), UI passa no vitest acima — **parcialmente fechado em 2026-11-11**: `E01-S179_impedimento_material_os.test.sql` (16 assertions, PASS local e suite completa) prova `sso_declarar_impedimento_material_os`/`sso_listar_impedimentos_material_os` (1354) de ponta a ponta — origem só por evento de exceção, máquina de estado suspenso/retomado, concorrência otimista, idempotência, isolamento de Cliente, append-only. Achado lateral: `sso_registrar_lista_materiais`/`sso_informar_material` (núcleo) perderam grant em 1059/1061 — caminho real é `_mediada`/`_mediado`, não bug. **Ainda sem pgTAP**: disponibilidade (0328) e demais migrations de exceção/ingestão de US2.
- Camada `application/` ausente por padrão arquitetural repetido nesta sessão (componentes chamam RPC direto, estilo "mediada"), não é lacuna isolada de S179.
- Candidata, junto com S175, a receber pgTAP real numa próxima sessão (não reimplementar código).

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S179-central-materiais-os/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S179_listas_materiais.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S179 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S179-central-materiais-os/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Organizar lista simples e revisável

**Independent Test:** Importar bullets com quantidades, linha vazia e prosa ambígua; juntar/dividir e comparar original preservado.

- [ ] T004 [US1] Escrever teste unitário falho para persistir lista/texto original e parser determinístico com editor opcional de linhas e Central filtrável em `apps/web/src/features/pcm/domain/listas-materiais-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/listas-materiais-us1.test.ts` conforme `specs/E01-S179-central-materiais-os/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar persistir lista/texto original e parser determinístico com editor opcional de linhas e Central filtrável em `apps/web/src/features/pcm/domain/listas-materiais.ts`, preservando constraints de `specs/E01-S179-central-materiais-os/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/listas-materiais.ts` e `apps/web/src/features/pcm/infrastructure/supabase-listas-materiais-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/listas-materiais-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/listas-materiais/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Controlar disponibilidade por informação e exceção

**Independent Test:** Cliente informa lista disponível, técnico aponta dois faltantes; PCM suspende/reprograma a mesma OS e consulta histórico.

- [ ] T009 [US2] Escrever teste unitário falho para registrar transições e exceção por lista/linha, suspensão da mesma OS e contrato de aquisição sem duplicar execução em `apps/web/src/features/pcm/domain/listas-materiais-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/listas-materiais-us2.test.ts` conforme `specs/E01-S179-central-materiais-os/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar registrar transições e exceção por lista/linha, suspensão da mesma OS e contrato de aquisição sem duplicar execução em `apps/web/src/features/pcm/domain/listas-materiais.ts`, preservando constraints de `specs/E01-S179-central-materiais-os/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/listas-materiais.ts` e `apps/web/src/features/pcm/infrastructure/supabase-listas-materiais-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/listas-materiais-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/listas-materiais/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-listas-materiais-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/listas-materiais.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S179-central-materiais-os/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S179-central-materiais-os/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S167, E01-S171, E01-S170 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Estoque/ERP completo; conferir fisicamente material do cliente obrigatoriamente; inventar unidade/produto; tratar compra como despesa/reembolso.
