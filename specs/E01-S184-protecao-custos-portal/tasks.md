# Tasks — E01-S184: Proteção de custos em respostas e documentos do Portal

**Status**: Em andamento; proteção parcial, sem PASS.
**Input**: spec.md, plan.md, research.md, data-model.md e contracts/commands.md.
**Dependências**: Independente; correção crítica prévia à E01-S181/E01-S183.
**Tests**: Obrigatórios por AC; escrever e observar falha antes de implementar. Não executar escrita externa real.

## Phase 1 — Setup

- [X] T001 Conferir dependências, ADR-0026/0027/0028 e contrato global em docs/planejamento/plano-manutencao/contratos-programa.md; registrar mapa de reuso em specs/E01-S184-protecao-custos-portal/research.md (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T002 Definir DTOs/envelope e invariantes de specs/E01-S184-protecao-custos-portal/contracts/commands.md em packages/shared/src/protecao-custos-portal-contracts.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

Contrato do programa e autorização administrativa existente são pré-requisitos; E01-S170 não bloqueia a correção inicial. Não ampliar schema antes dos testes falharem; migrations pertencem à US que introduz a regra.

## Phase 3 — US1: Receber somente campos públicos

**Independent test**: Semear custo sentinela no snapshot, consultar como Cliente e inspecionar JSON bruto.

- [ ] T003 [US1] Escrever testes falhando de receber somente campos públicos em apps/web/src/features/area-cliente/application/protecao-custos-portal-us1.test.ts (AC-1, AC-2).
- [ ] T004 [US1] Escrever pgTAP permitido/negado, repetição e vínculo das regras US1 em supabase/tests/E01-S184_protecao_custos_portal_us1.test.sql (AC-1, AC-2).
- [ ] T005 [US1] Implementar projeções públicas allowlist e fechar leituras diretas/legadas por servidor em apps/web/src/features/area-cliente/domain/protecao-custos-portal.ts e migration aditiva E01-S184 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-1, AC-2).
- [ ] T006 [US1] Expor comandos autorizados US1 em apps/web/src/features/area-cliente/application/protecao-custos-portal.ts e apps/web/src/features/area-cliente/infrastructure/supabase-protecao-custos-portal-adapter.ts conforme contracts/commands.md (AC-1, AC-2).
- [ ] T007 [US1] Integrar jornada US1 em apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts e apps/web/src/features/area-cliente/application/protecao-custos-portal-queries.ts com invalidação por Conta e estados de interface (AC-1, AC-2).

## Phase 4 — US2: Gerar documento público sem alterar histórico interno

**Independent test**: Baixar versão antiga/nova e comparar privado intacto com público sanitizado.

- [ ] T008 [US2] Escrever testes falhando de documento público sem custo e versão histórica em apps/web/src/features/comercial/domain/proposta-pdf.test.ts e apps/web/src/features/area-cliente/application/protecao-custos-portal-us2.test.ts (AC-3, AC-4).
- [ ] T009 [US2] Escrever pgTAP permitido/negado, repetição e vínculo das regras US2 em supabase/tests/E01-S184_protecao_custos_portal_us2.test.sql (AC-3, AC-4).
- [ ] T010 [US2] Separar formatação pública de interna em apps/web/src/features/comercial/domain/proposta-pdf.ts e packages/shared/src/protecao-custos-portal-contracts.ts, consumindo somente snapshot público versionado, sem fallback de custo e sem editar versão privada (AC-3, AC-4).
- [ ] T011 [US2] Expor comandos autorizados US2 em apps/web/src/features/area-cliente/application/protecao-custos-portal.ts e apps/web/src/features/area-cliente/infrastructure/supabase-protecao-custos-portal-adapter.ts conforme contracts/commands.md (AC-3, AC-4).
- [ ] T012 [US2] Integrar jornada US2 em apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts e apps/web/src/features/area-cliente/application/protecao-custos-portal-queries.ts com invalidação por Conta e estados de interface (AC-3, AC-4).

## Phase 5 — US3: Proteger acesso interno autorizado e anexos

**Independent test**: Comparar usuário interno com e sem ver custos; verificar link de anexo.

- [ ] T013 [US3] Escrever testes falhando de proteger acesso interno autorizado e anexos em apps/web/src/features/area-cliente/application/protecao-custos-portal-us3.test.ts (AC-5, AC-6).
- [ ] T014 [US3] Escrever pgTAP permitido/negado, repetição e vínculo das regras US3 em supabase/tests/E01-S184_protecao_custos_portal_us3.test.sql (AC-5, AC-6).
- [ ] T015 [US3] Implementar leitura interna restrita, política de anexos e remediação auditada de artefatos em apps/web/src/features/area-cliente/domain/protecao-custos-portal.ts e migration aditiva E01-S184 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-5, AC-6).
- [ ] T016 [US3] Expor comandos autorizados US3 em apps/web/src/features/area-cliente/application/protecao-custos-portal.ts e apps/web/src/features/area-cliente/infrastructure/supabase-protecao-custos-portal-adapter.ts conforme contracts/commands.md (AC-5, AC-6).
- [ ] T017 [US3] Integrar jornada US3 em apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts e apps/web/src/features/area-cliente/application/protecao-custos-portal-queries.ts com invalidação por Conta e estados de interface (AC-5, AC-6).

## Phase 6 — Integração e evidências

- [ ] T018 Cobrir jornada crítica, acesso direto e sessão revogada em apps/web/e2e/protecao-custos-portal.spec.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T019 Executar quickstart, revisão adversarial e registrar comandos/resultados/ressalvas em specs/E01-S184-protecao-custos-portal/quickstart.md antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

T001 antes de T002; US1 é MVP. Em cada US, testes de application e pgTAP precedem persistência/domínio, adapter e interface. US2 e US3 usam objetos da US1 com fixtures próprias para verificação independente. Sem execução paralela de alterações no mesmo domain/adapter/page/migration; testes US1 de application e SQL podem ser preparados em paralelo por estarem em arquivos distintos.

## Implementation Strategy

Entregar uma US por vez, provar seus AC em ambiente local e preservar caminho legado necessário. Verificar catálogo CT-024 e CT-027. Somente depois completar evidências e revisão adversarial; deploy/cobrança/Auvo real dependem da etapa operacional própria. Todos os AC têm teste e implementação; nenhuma task marcada como concluída nesta entrega.

