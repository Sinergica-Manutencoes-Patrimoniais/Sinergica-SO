# Tasks — E01-S181: Orçamento operacional canônico no Comercial

**Status**: Especificada — implementação não iniciada.
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

