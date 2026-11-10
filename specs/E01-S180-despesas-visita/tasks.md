# Tasks — E01-S180: Despesas previstas e realizadas por Visita

**Status**: Especificada — implementação não iniciada.
**Input**: spec.md, plan.md, research.md, data-model.md e contracts/commands.md.
**Dependências**: E01-S171 (Visita) e E01-S170 (autorização).
**Tests**: Obrigatórios por AC; escrever e observar falha antes de implementar. Não executar escrita externa real.

## Phase 1 — Setup

- [ ] T001 Conferir dependências, ADR-0026/0027/0028 e contrato global em docs/planejamento/plano-manutencao/contratos-programa.md; registrar mapa de reuso em specs/E01-S180-despesas-visita/research.md (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T002 Definir DTOs/envelope e invariantes de specs/E01-S180-despesas-visita/contracts/commands.md em packages/shared/src/despesas-visita-contracts.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

Contrato do programa e autorizações são pré-requisitos. Não ampliar schema antes dos testes falharem; migrations pertencem à US que introduz a regra.

## Phase 3 — US1: Registrar despesa oficial da Visita

**Independent test**: Criar previsão, registrar realizado com comprovante e reenviar o mesmo comando.

- [ ] T003 [US1] Escrever testes falhando de registrar despesa oficial da visita em apps/web/src/features/pcm/application/despesas-visita-us1.test.ts (AC-1, AC-2).
- [ ] T004 [US1] Escrever pgTAP permitido/negado, repetição e vínculo das regras US1 em supabase/tests/E01-S180_despesas_visita_us1.test.sql (AC-1, AC-2).
- [ ] T005 [US1] Implementar agregado, idempotência e transição previsto/realizado sem dupla soma em apps/web/src/features/pcm/domain/despesas-visita.ts e migration aditiva E01-S180 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-1, AC-2).
- [ ] T006 [US1] Expor comandos autorizados US1 em apps/web/src/features/pcm/application/despesas-visita.ts e apps/web/src/features/pcm/infrastructure/supabase-despesas-visita-adapter.ts conforme contracts/commands.md (AC-1, AC-2).
- [ ] T007 [US1] Integrar jornada US1 em apps/web/src/features/pcm/pages/DespesasVisitaPage.tsx e apps/web/src/features/pcm/application/despesas-visita-queries.ts com invalidação por Conta e estados de interface (AC-1, AC-2).

## Phase 4 — US2: Ratear e distinguir aquisição

**Independent test**: Ratear R$100 entre duas OS e comparar total por Visita.

- [ ] T008 [US2] Escrever testes falhando de ratear e distinguir aquisição em apps/web/src/features/pcm/application/despesas-visita-us2.test.ts (AC-3, AC-4).
- [ ] T009 [US2] Escrever pgTAP permitido/negado, repetição e vínculo das regras US2 em supabase/tests/E01-S180_despesas_visita_us2.test.sql (AC-3, AC-4).
- [ ] T010 [US2] Implementar rateio exato e classificação aquisição/Visita com arredondamento em centavos em apps/web/src/features/pcm/domain/despesas-visita.ts e migration aditiva E01-S180 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-3, AC-4).
- [ ] T011 [US2] Expor comandos autorizados US2 em apps/web/src/features/pcm/application/despesas-visita.ts e apps/web/src/features/pcm/infrastructure/supabase-despesas-visita-adapter.ts conforme contracts/commands.md (AC-3, AC-4).
- [ ] T012 [US2] Integrar jornada US2 em apps/web/src/features/pcm/pages/DespesasVisitaPage.tsx e apps/web/src/features/pcm/application/despesas-visita-queries.ts com invalidação por Conta e estados de interface (AC-3, AC-4).

## Phase 5 — US3: Cancelar com histórico e controlar acesso

**Independent test**: Cancelar registro não contabilizado e tentar alteração por cliente.

- [ ] T013 [US3] Escrever testes falhando de cancelar com histórico e controlar acesso em apps/web/src/features/pcm/application/despesas-visita-us3.test.ts (AC-5, AC-6).
- [ ] T014 [US3] Escrever pgTAP permitido/negado, repetição e vínculo das regras US3 em supabase/tests/E01-S180_despesas_visita_us3.test.sql (AC-5, AC-6).
- [ ] T015 [US3] Implementar cancelamento auditado, comprovantes privados e autorização server-side em apps/web/src/features/pcm/domain/despesas-visita.ts e migration aditiva E01-S180 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-5, AC-6).
- [ ] T016 [US3] Expor comandos autorizados US3 em apps/web/src/features/pcm/application/despesas-visita.ts e apps/web/src/features/pcm/infrastructure/supabase-despesas-visita-adapter.ts conforme contracts/commands.md (AC-5, AC-6).
- [ ] T017 [US3] Integrar jornada US3 em apps/web/src/features/pcm/pages/DespesasVisitaPage.tsx e apps/web/src/features/pcm/application/despesas-visita-queries.ts com invalidação por Conta e estados de interface (AC-5, AC-6).

## Phase 6 — Integração e evidências

- [ ] T018 Cobrir jornada crítica, acesso direto e sessão revogada em apps/web/e2e/despesas-visita.spec.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T019 Executar quickstart, revisão adversarial e registrar comandos/resultados/ressalvas em specs/E01-S180-despesas-visita/quickstart.md antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

T001 antes de T002; US1 é MVP. Em cada US, testes de application e pgTAP precedem persistência/domínio, adapter e interface. US2 e US3 usam objetos da US1 com fixtures próprias para verificação independente. Sem execução paralela de alterações no mesmo domain/adapter/page/migration; testes US1 de application e SQL podem ser preparados em paralelo por estarem em arquivos distintos.

## Implementation Strategy

Entregar uma US por vez, provar seus AC em ambiente local e preservar caminho legado necessário. Verificar catálogo CT-027 (segurança transversal). Somente depois completar evidências e revisão adversarial; deploy/cobrança/Auvo real dependem da etapa operacional própria. Todos os AC têm teste e implementação; nenhuma task marcada como concluída nesta entrega.

