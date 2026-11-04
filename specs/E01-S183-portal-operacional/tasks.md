# Tasks — E01-S183: Portal operacional de materiais, orçamento e cobrança

**Status**: Especificada — implementação não iniciada.
**Input**: spec.md, plan.md, research.md, data-model.md e contracts/commands.md.
**Dependências**: E01-S179, E01-S181, E01-S182, E01-S184 e E01-S170.
**Tests**: Obrigatórios por AC; escrever e observar falha antes de implementar. Não executar escrita externa real.

## Phase 1 — Setup

- [ ] T001 Conferir dependências, ADR-0026/0027/0028 e contrato global em docs/planejamento/plano-manutencao/contratos-programa.md; registrar mapa de reuso em specs/E01-S183-portal-operacional/research.md (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T002 Definir DTOs/envelope e invariantes de specs/E01-S183-portal-operacional/contracts/commands.md em packages/shared/src/portal-operacional-contracts.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

Contrato do programa e autorizações são pré-requisitos. Não ampliar schema antes dos testes falharem; migrations pertencem à US que introduz a regra.

## Phase 3 — US1: Consultar e informar disponibilidade de materiais

**Independent test**: Cliente A informa disponibilidade; PCM vê aviso; Cliente B é recusado.

- [ ] T003 [US1] Escrever testes falhando de consultar e informar disponibilidade de materiais em apps/web/src/features/area-cliente/application/portal-operacional-us1.test.ts (AC-1, AC-2).
- [ ] T004 [US1] Escrever pgTAP permitido/negado, repetição e vínculo das regras US1 em supabase/tests/E01-S183_portal_operacional_us1.test.sql (AC-1, AC-2).
- [ ] T005 [US1] Implementar leitura e informação de disponibilidade vinculadas à mesma lista/OS em apps/web/src/features/area-cliente/domain/portal-operacional.ts e migration aditiva E01-S183 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-1, AC-2).
- [ ] T006 [US1] Expor comandos autorizados US1 em apps/web/src/features/area-cliente/application/portal-operacional.ts e apps/web/src/features/area-cliente/infrastructure/supabase-portal-operacional-adapter.ts conforme contracts/commands.md (AC-1, AC-2).
- [ ] T007 [US1] Integrar jornada US1 em apps/web/src/features/area-cliente/pages/PortalOperacionalPage.tsx e apps/web/src/features/area-cliente/application/portal-operacional-queries.ts com invalidação por Conta e estados de interface (AC-1, AC-2).

## Phase 4 — US2: Decidir versão e acompanhar cobrança

**Independent test**: Aprovar versão vigente, recusar antiga e consultar documento financeiro público.

- [ ] T008 [US2] Escrever testes falhando de decidir versão e acompanhar cobrança em apps/web/src/features/area-cliente/application/portal-operacional-us2.test.ts (AC-3, AC-4).
- [ ] T009 [US2] Escrever pgTAP permitido/negado, repetição e vínculo das regras US2 em supabase/tests/E01-S183_portal_operacional_us2.test.sql (AC-3, AC-4).
- [ ] T010 [US2] Implementar decisão versionada idempotente e navegação pública até cobrança em apps/web/src/features/area-cliente/domain/portal-operacional.ts e migration aditiva E01-S183 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-3, AC-4).
- [ ] T011 [US2] Expor comandos autorizados US2 em apps/web/src/features/area-cliente/application/portal-operacional.ts e apps/web/src/features/area-cliente/infrastructure/supabase-portal-operacional-adapter.ts conforme contracts/commands.md (AC-3, AC-4).
- [ ] T012 [US2] Integrar jornada US2 em apps/web/src/features/area-cliente/pages/PortalOperacionalPage.tsx e apps/web/src/features/area-cliente/application/portal-operacional-queries.ts com invalidação por Conta e estados de interface (AC-3, AC-4).

## Phase 5 — US3: Isolar Contas e revogar contatos

**Independent test**: Tentar objetos de B pela sessão de A e repetir depois de revogar contato.

- [ ] T013 [US3] Escrever testes falhando de isolar contas e revogar contatos em apps/web/src/features/area-cliente/application/portal-operacional-us3.test.ts (AC-5, AC-6).
- [ ] T014 [US3] Escrever pgTAP permitido/negado, repetição e vínculo das regras US3 em supabase/tests/E01-S183_portal_operacional_us3.test.sql (AC-5, AC-6).
- [ ] T015 [US3] Implementar isolamento, múltiplos contatos, revogação imediata e anexos seguros em apps/web/src/features/area-cliente/domain/portal-operacional.ts e migration aditiva E01-S183 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-5, AC-6).
- [ ] T016 [US3] Expor comandos autorizados US3 em apps/web/src/features/area-cliente/application/portal-operacional.ts e apps/web/src/features/area-cliente/infrastructure/supabase-portal-operacional-adapter.ts conforme contracts/commands.md (AC-5, AC-6).
- [ ] T017 [US3] Integrar jornada US3 em apps/web/src/features/area-cliente/pages/PortalOperacionalPage.tsx e apps/web/src/features/area-cliente/application/portal-operacional-queries.ts com invalidação por Conta e estados de interface (AC-5, AC-6).

## Phase 6 — Integração e evidências

- [ ] T018 Cobrir jornada crítica, acesso direto e sessão revogada em apps/web/e2e/portal-operacional.spec.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T019 Executar quickstart, revisão adversarial e registrar comandos/resultados/ressalvas em specs/E01-S183-portal-operacional/quickstart.md antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

T001 antes de T002; US1 é MVP. Em cada US, testes de application e pgTAP precedem persistência/domínio, adapter e interface. US2 e US3 usam objetos da US1 com fixtures próprias para verificação independente. Sem execução paralela de alterações no mesmo domain/adapter/page/migration; testes US1 de application e SQL podem ser preparados em paralelo por estarem em arquivos distintos.

## Implementation Strategy

Entregar uma US por vez, provar seus AC em ambiente local e preservar caminho legado necessário. Verificar catálogo CT-027. Somente depois completar evidências e revisão adversarial; deploy/cobrança/Auvo real dependem da etapa operacional própria. Todos os AC têm teste e implementação; nenhuma task marcada como concluída nesta entrega.

