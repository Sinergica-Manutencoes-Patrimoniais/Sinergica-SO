# Tasks — E01-S181: Orçamento operacional canônico no Comercial

**Status** (auditoria de código em 2026-11-10, madrugada): **story essencialmente pronta**, "0% implementado" estava completamente errado. Realidade: **56 migrations** `E01-S181` (0336→1561): origem operacional sem oportunidade, criação/publicação de orçamento, snapshot de itens públicos (proteção S184), dispensa+revogação, exceção de preço mediada (1561), decisão PCM versionada com barreira (0908/0909), assessment de cliente, composição mista (fonte aquisição + parcela de despesa), retificação de fonte de aquisição, correlação de gasto, histórico legado (OS e pré-OS) separado. UI real: **28 arquivos em `interfaces/orcamento-operacional/`** (2113 linhas), `infrastructure/supabase-orcamento-operacional-adapter.ts` (188 linhas), `packages/shared/src/orcamento-operacional-contracts.ts`. Wiring confirmado real: `DashboardComercialPage.tsx:25` importa `PainelGlobalOperacional` (não é código morto).
- **AC-1/AC-2** (US1, formar preço): REAL via `sso_preparar_orcamento_operacional`/`PrepararOrcamento.tsx` — **sem pgTAP dedicado confirmado**.
- **AC-3/AC-4** (US2, versionar/dispensar): REAL via `sso_decidir_orcamento_pcm` (testado: `E01-S181_decisao_pcm_cliente.test.sql` plan 15) + `sso_dispensar_orcamento` (não testado) + `TransicionarOperacional.tsx`/`DispensarOrcamento.tsx` (testados em TS).
- **AC-5/AC-6** (US3, unificar legado): REAL via migrations de histórico legado (0899/0901/1350/1373/1374) + `HistoricoLegadoOs.tsx`/`HistoricoLegadoPreOs.tsx` — sem pgTAP dedicado.
- **GAP-REAL-CONFIRMADO**: só 2 arquivos pgTAP tagueados (`E01-S181_assessment_cliente.test.sql` plan 9, `_decisao_pcm_cliente.test.sql` plan 15 = 24 assertions) pra 56 migrations. `sso_retificar_fonte_aquisicao`, `sso_declarar_correlacao_gasto`, `sso_dispensar_orcamento`, `sso_excepcionar_preco_mediado`, `sso_listar_orcamentos_os` e a maior parte do resto **não têm nenhum pgTAP**. `domain/`/`application/orcamento-operacional.ts` planejados em T005/T006/T010/T011/T015/T016 **não existem** — UI chama RPC direto (mesmo padrão "mediada" visto em várias stories hoje).
- Vitest rodado (4 arquivos de dentro de `apps/web/`): **15 passed**.
- Gap real não é "construir" — é escrever pgTAP pras ~50 RPCs sem teste, ou documentar o desvio arquitetural (sem domain/application) como aceito. Não reimplementar.
**Input**: spec.md, plan.md, research.md, data-model.md e contracts/commands.md.
**Dependências**: E01-S179 (materiais), E01-S170 (autorização) e E01-S184 (proteção de custos).
**Tests**: Obrigatórios por AC; escrever e observar falha antes de implementar. Não executar escrita externa real.

## Phase 1 — Setup

- [ ] T001 Conferir dependências, ADR-0026/0027/0028 e contrato global em docs/planejamento/plano-manutencao/contratos-programa.md; registrar mapa de reuso em specs/E01-S181-orcamentos-operacionais/research.md (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T002 Definir DTOs/envelope e invariantes de specs/E01-S181-orcamentos-operacionais/contracts/commands.md em packages/shared/src/orcamento-operacional-contracts.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

Contrato do programa e autorizações são pré-requisitos. Não ampliar schema antes dos testes falharem; migrations pertencem à US que introduz a regra.

## Phase 3 — US1: Formar preço de fornecimento com custos protegidos

**Independent test**: Custo R$100 gera sugestão R$150 e cliente recebe somente descrição/preço autorizados.

- [ ] T003 [US1] Escrever testes falhando de formar preço de fornecimento com custos protegidos em apps/web/src/features/comercial/application/orcamento-operacional-us1.test.ts (AC-1, AC-2).
- [ ] T004 [US1] Escrever pgTAP permitido/negado, repetição e vínculo das regras US1 em supabase/tests/E01-S181_orcamentos_operacionais_us1.test.sql (AC-1, AC-2).
- [ ] T005 [US1] Implementar formação de preço operacional e permissão de piso sobre proposta existente em apps/web/src/features/comercial/domain/orcamento-operacional.ts e migration aditiva E01-S181 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-1, AC-2).
- [ ] T006 [US1] Expor comandos autorizados US1 em apps/web/src/features/comercial/application/orcamento-operacional.ts e apps/web/src/features/comercial/infrastructure/supabase-orcamento-operacional-adapter.ts conforme contracts/commands.md (AC-1, AC-2).
- [ ] T007 [US1] Integrar jornada US1 em apps/web/src/features/comercial/pages/OrcamentoOperacionalPage.tsx e apps/web/src/features/comercial/application/orcamento-operacional-queries.ts com invalidação por Conta e estados de interface (AC-1, AC-2).

## Phase 4 — US2: Versionar decisão ou dispensar documento

**Independent test**: Enviar, aprovar e complementar proposta; dispensar outra com motivo.

- [ ] T008 [US2] Escrever testes falhando de versionar decisão ou dispensar documento em apps/web/src/features/comercial/application/orcamento-operacional-us2.test.ts (AC-3, AC-4).
- [ ] T009 [US2] Escrever pgTAP permitido/negado, repetição e vínculo das regras US2 em supabase/tests/E01-S181_orcamentos_operacionais_us2.test.sql (AC-3, AC-4).
- [ ] T010 [US2] Implementar estados, versões congeladas, decisões, complemento e dispensa auditada em apps/web/src/features/comercial/domain/orcamento-operacional.ts e migration aditiva E01-S181 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-3, AC-4).
- [ ] T011 [US2] Expor comandos autorizados US2 em apps/web/src/features/comercial/application/orcamento-operacional.ts e apps/web/src/features/comercial/infrastructure/supabase-orcamento-operacional-adapter.ts conforme contracts/commands.md (AC-3, AC-4).
- [ ] T012 [US2] Integrar jornada US2 em apps/web/src/features/comercial/pages/OrcamentoOperacionalPage.tsx e apps/web/src/features/comercial/application/orcamento-operacional-queries.ts com invalidação por Conta e estados de interface (AC-3, AC-4).

## Phase 5 — US3: Unificar fonte e compatibilizar legado

**Independent test**: Decidir orçamento legado duas vezes e emitir novo pela OS existente.

- [ ] T013 [US3] Escrever testes falhando de unificar fonte e compatibilizar legado em apps/web/src/features/comercial/application/orcamento-operacional-us3.test.ts (AC-5, AC-6).
- [ ] T014 [US3] Escrever pgTAP permitido/negado, repetição e vínculo das regras US3 em supabase/tests/E01-S181_orcamentos_operacionais_us3.test.sql (AC-5, AC-6).
- [ ] T015 [US3] Implementar fonte canônica, vínculo operacional e compatibilidade de decisão legado sem OS duplicada em apps/web/src/features/comercial/domain/orcamento-operacional.ts e migration aditiva E01-S181 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-5, AC-6).
- [ ] T016 [US3] Adaptar origem operacional em apps/web/src/features/comercial/application/proposta.ts, apps/web/src/features/comercial/application/proposta-gateway.ts e apps/web/src/features/comercial/infrastructure/supabase-proposta-adapter.ts, reaproveitados por application/orcamento-operacional.ts conforme contracts/commands.md (AC-5, AC-6).
- [ ] T017 [US3] Integrar jornada US3 em apps/web/src/features/comercial/pages/OrcamentoOperacionalPage.tsx e apps/web/src/features/comercial/application/orcamento-operacional-queries.ts com invalidação por Conta e estados de interface (AC-5, AC-6).

## Phase 6 — Integração e evidências

- [ ] T018 Cobrir jornada crítica, acesso direto e sessão revogada em apps/web/e2e/orcamentos-operacionais.spec.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T019 Executar quickstart, revisão adversarial e registrar comandos/resultados/ressalvas em specs/E01-S181-orcamentos-operacionais/quickstart.md antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

T001 antes de T002; US1 é MVP. Em cada US, testes de application e pgTAP precedem persistência/domínio, adapter e interface. US2 e US3 usam objetos da US1 com fixtures próprias para verificação independente. Sem execução paralela de alterações no mesmo domain/adapter/page/migration; testes US1 de application e SQL podem ser preparados em paralelo por estarem em arquivos distintos.

## Implementation Strategy

Entregar uma US por vez, provar seus AC em ambiente local e preservar caminho legado necessário. Verificar catálogo CT-024 e CT-025. Somente depois completar evidências e revisão adversarial; deploy/cobrança/Auvo real dependem da etapa operacional própria. Todos os AC têm teste e implementação; nenhuma task marcada como concluída nesta entrega.

