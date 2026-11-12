# Tasks — E01-S169: Importação e exportação dos Planos Rimini e I Home

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status** (auditoria de código em 2026-11-10, madrugada): **story essencialmente pronta**, tasks.md estava desatualizado. Nota de nomenclatura: a spec/pasta chama "importação de despesas", mas o conteúdo real é sobre importar cronogramas Rimini/I Home via XLSX — despesas são E01-S180 (`spec.md` já diz "Out of Scope: Despesas, transferidas E01-S180"); código real usa "cronograma" em todo lugar, exceto o diretório de UI (`interfaces/importacao-plano/`, que coincidentemente bate com o plano).
- **Backend**: 38 migrations `E01-S169` (0347→1470) cobrindo o pipeline inteiro: staging (0347/0361), mapeamento (0367/1050), classificação (0479), conferência (0482/1052), aprovação (0485), incorporação de Rotina (0494/0504), exportação de snapshot PDF/XLSX (1073, AC-5), recepção XLSX via edge function `pcm-cronograma-xlsx-receber` (1081-1085), tolerância/reprocessamento (0498/1053, AC-4), reconciliação de legado (1077-1080). 7 arquivos pgTAP reais na seleção oficial `db-tests`.
- **Frontend**: `interfaces/importacao-plano/Workspace.tsx` existe de verdade (bate com o plano) com ~20 componentes (`AprovarLote`, `ClassificacaoLinha`, `ConferenciaIntegrada`, `IncorporarLote/Linha`, `LotesLegados`, `MapeamentoLinha`, `PreviaXlsx(Workspace)`, `ReconciliarLegado`, `RevisaoLinha`, `ToleranciaLinha`, `EntradaCsv`, `AvisosXlsx`, `CompararLotes`) mais domain/application/infrastructure sob o nome `*cronograma*`. 19 arquivos de teste rodados de dentro de `apps/web/`: **100/100 passed**, incluindo `JornadaCronograma.test.tsx` (integração ponta a ponta, matriz→Rotina rascunho).
- **Gaps reais possíveis (não confirmados)**: (1) a própria migration 0347 se auto-declara em SPEC_DEVIATION conflitante com E01-S178 — não confirmado se 0361 (`staging_unificado`) já é a reconciliação ou se 0347 ficou órfã; manter a nota T003 como estava até confirmar. (2) AC-5/AC-6 (exportação opcional, cronograma operacional distinguindo baseline/programado) — `ExportarCronogramaFotografia.tsx`/`exportacao-cronograma-autenticada.ts` existem e testam, mas não confirmado se cobrem literalmente "não promete 52 Visitas após supressões" (AC-6).
- Não é gap de código, é gap de rastreamento — risco real de retrabalho se alguém tentar reimplementar do zero. Não reimplementar.

## Phase 1 — Setup

- [ ] T001 Revalidar dependências e reuso em `specs/E01-S169-importacao-despesas-exportacao/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S169_importacao_plano.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Reusar staging/RPCs E01-S178 conforme `specs/E01-S169-importacao-despesas-exportacao/data-model.md`; preparar gateway de importação sem tabela concorrente em `apps/web/src/features/pcm/application/importacao-plano-gateway.ts` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
  - SPEC_DEVIATION: migration 0347 preparou staging separado; reconciliar com E01-S178 antes de aplicar ou ativar. Não considerar T003 concluída.

## Phase 3 — US1: Conferir e importar planos sem inventar dados

**Independent Test:** Mapear Rimini 59 linhas e I Home 53; repetir lote e incluir um vínculo inexistente e tempo SPCI zero.

- [ ] T004 [US1] Escrever teste unitário falho para mapear planilhas para staging aprovado de Plano/Rotina com periodicidade/duração explícitas e pendências de tempo, sem efeito operacional em `apps/web/src/features/pcm/domain/importacao-plano-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3, AC-4).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/importacao-plano-us1.test.ts` conforme `specs/E01-S169-importacao-despesas-exportacao/contracts/commands.md` (AC-1, AC-2, AC-3, AC-4).
- [ ] T006 [US1] Implementar mapear planilhas para staging aprovado de Plano/Rotina com periodicidade/duração explícitas e pendências de tempo, sem efeito operacional em `apps/web/src/features/pcm/domain/importacao-plano.ts`, preservando constraints de `specs/E01-S169-importacao-despesas-exportacao/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3, AC-4).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/importacao-plano.ts` e `apps/web/src/features/pcm/infrastructure/supabase-importacao-plano-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3, AC-4).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/importacao-plano-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/importacao-plano/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3, AC-4).

## Phase 4 — US2: Exportar versão e cronograma conferíveis

**Independent Test:** Exportar Plano filtrado em PDF/XLSX e comparar datas, alvo, versão, filtros e capacidade opcional.

- [ ] T009 [US2] Escrever teste unitário falho para exportar snapshot e filtros idênticos nos formatos PDF/XLSX com capacidade opcional e indicação de tempo pendente em `apps/web/src/features/pcm/domain/importacao-plano-us2.test.ts`, usando todos os cenários desta US (AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/importacao-plano-us2.test.ts` conforme `specs/E01-S169-importacao-despesas-exportacao/contracts/commands.md` (AC-5, AC-6).
- [ ] T011 [US2] Implementar exportar snapshot e filtros idênticos nos formatos PDF/XLSX com capacidade opcional e indicação de tempo pendente em `apps/web/src/features/pcm/domain/importacao-plano.ts`, preservando constraints de `specs/E01-S169-importacao-despesas-exportacao/data-model.md` e decisões de `spec.md` (AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/importacao-plano.ts` e `apps/web/src/features/pcm/infrastructure/supabase-importacao-plano-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/importacao-plano-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/importacao-plano/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-importacao-plano-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/importacao-plano.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S169-importacao-despesas-exportacao/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S169-importacao-despesas-exportacao/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S165, E01-S166, E01-S178 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Despesas (transferidas E01-S180); recriar staging; inventar cadastro/mapeamento Auvo; declarar equivalência executiva de X.
