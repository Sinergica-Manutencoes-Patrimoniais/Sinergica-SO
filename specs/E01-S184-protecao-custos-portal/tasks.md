# Tasks — E01-S184: Proteção de custos em respostas e documentos do Portal

**Status**: Em andamento (2026-11-10). AC-1 a AC-6 provados por CI (`db-tests`, PR #73) e revisão adversarial sem achado alto/médio nos 6 AC. Falta T018 (e2e Portal/cliente-sindico — bloqueado, ver nota) e homologação (S186) antes de PASS.
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

- [X] T003 [US1] Escrever testes falhando de receber somente campos públicos em apps/web/src/features/area-cliente/application/protecao-custos-portal-us1.test.ts (AC-1, AC-2). Evidência: `pnpm exec vitest run` local, PASS — adapter só lê `portal_propostas`/`portal_orcamentos_servico`, nenhuma seleção de coluna de custo; ver `quickstart.md`.
- [ ] T004 [US1] Escrever pgTAP permitido/negado, repetição e vínculo das regras US1 em supabase/tests/E01-S184_protecao_custos_portal_us1.test.sql (AC-1, AC-2).
- [ ] T005 [US1] Implementar projeções públicas allowlist e fechar leituras diretas/legadas por servidor em apps/web/src/features/area-cliente/domain/protecao-custos-portal.ts e migration aditiva E01-S184 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-1, AC-2).
- [ ] T006 [US1] Expor comandos autorizados US1 em apps/web/src/features/area-cliente/application/protecao-custos-portal.ts e apps/web/src/features/area-cliente/infrastructure/supabase-protecao-custos-portal-adapter.ts conforme contracts/commands.md (AC-1, AC-2).
- [ ] T007 [US1] Integrar jornada US1 em apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts e apps/web/src/features/area-cliente/application/protecao-custos-portal-queries.ts com invalidação por Conta e estados de interface (AC-1, AC-2).

## Phase 4 — US2: Gerar documento público sem alterar histórico interno

**Independent test**: Baixar versão antiga/nova e comparar privado intacto com público sanitizado.

- [ ] T008 [US2] Escrever testes falhando de documento público sem custo e versão histórica em apps/web/src/features/comercial/domain/proposta-pdf.test.ts e apps/web/src/features/area-cliente/application/protecao-custos-portal-us2.test.ts (AC-3, AC-4).
- [X] T009 [US2] Escrever pgTAP permitido/negado, repetição e vínculo das regras US2 em supabase/tests/E01-S184_protecao_custos_portal_us2.test.sql (AC-3, AC-4). Evidência: `gh pr checks 73` → `db-tests` pass (run 42828439686, job 129871790303, 2m57s), PR #73. Prova AC-4 pelo caminho real (`comercial.fn_duplicar_proposta`): proposta terminal nunca reabre, `proposta_versoes` imutável por GRANT, trilha `duplicadaDe` só privada, projeção pública por versão própria.
- [ ] T010 [US2] Separar formatação pública de interna em apps/web/src/features/comercial/domain/proposta-pdf.ts e packages/shared/src/protecao-custos-portal-contracts.ts, consumindo somente snapshot público versionado, sem fallback de custo e sem editar versão privada (AC-3, AC-4).
- [ ] T011 [US2] Expor comandos autorizados US2 em apps/web/src/features/area-cliente/application/protecao-custos-portal.ts e apps/web/src/features/area-cliente/infrastructure/supabase-protecao-custos-portal-adapter.ts conforme contracts/commands.md (AC-3, AC-4).
- [ ] T012 [US2] Integrar jornada US2 em apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts e apps/web/src/features/area-cliente/application/protecao-custos-portal-queries.ts com invalidação por Conta e estados de interface (AC-3, AC-4).

## Phase 5 — US3: Proteger acesso interno autorizado e anexos

**Independent test**: Comparar usuário interno com e sem ver custos; verificar link de anexo.

- [X] T013 [US3] Escrever testes falhando de proteger acesso interno autorizado e anexos em apps/web/src/features/area-cliente/application/protecao-custos-portal-us3.test.ts (AC-5, AC-6). Evidência: `pnpm exec vitest run` local, PASS — decisão só pelas RPCs seguras, adapter nunca referencia o bucket `financeiro-comprovantes`; ver `quickstart.md`.
- [ ] T014 [US3] Escrever pgTAP permitido/negado, repetição e vínculo das regras US3 em supabase/tests/E01-S184_protecao_custos_portal_us3.test.sql (AC-5, AC-6).
  - Segunda metade do AC-6/FR-006 (inventariar e retirar acesso de artefato público antigo com custo) fechada em migration 1829 (`pcm.sso_auditoria_anexos_publicados`, reusa publicação/revogação auditada de 0465/E01-S183) + `supabase/tests/E01-S184_auditoria_anexos_publicados.test.sql`. Evidência: `gh pr checks 73` → `db-tests` pass (run 42828439686, job 129871790303), PR #73.
- [ ] T015 [US3] Implementar leitura interna restrita, política de anexos e remediação auditada de artefatos em apps/web/src/features/area-cliente/domain/protecao-custos-portal.ts e migration aditiva E01-S184 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-5, AC-6).
- [ ] T016 [US3] Expor comandos autorizados US3 em apps/web/src/features/area-cliente/application/protecao-custos-portal.ts e apps/web/src/features/area-cliente/infrastructure/supabase-protecao-custos-portal-adapter.ts conforme contracts/commands.md (AC-5, AC-6).
- [ ] T017 [US3] Integrar jornada US3 em apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts e apps/web/src/features/area-cliente/application/protecao-custos-portal-queries.ts com invalidação por Conta e estados de interface (AC-5, AC-6).

## Phase 6 — Integração e evidências

- [ ] T018 Cobrir jornada crítica, acesso direto e sessão revogada em apps/web/e2e/protecao-custos-portal.spec.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
  - Bloqueado (2026-11-10): este repositório não tem nenhum e2e Playwright que autentique como `cliente-sindico` — `e2e/auth.setup.ts` só salva sessão de um usuário de teste único (via `SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD`). Exige segundo usuário de teste com papel `cliente-sindico` vinculado a Cliente, e decisão sobre workflow isolado dedicado (como S165/S166/S170/S176) já que `ci.yml` não roda e2e. `apps/web/e2e/comercial-proposta-pdf-portal.spec.ts` cobre a metade Comercial do AC-3 (criar/aprovar/baixar PDF/enviar); falta a metade Portal/Cliente.
- [X] T019 Executar quickstart, revisão adversarial e registrar comandos/resultados/ressalvas em specs/E01-S184-protecao-custos-portal/quickstart.md antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6). Revisão adversarial sem achado alto/médio nos 6 AC desta story; dois achados médios pré-existentes de E03-S04 registrados em `docs/SECURITY_DEBT.md` (SEC-009/SEC-010), não bloqueiam. PASS da story ainda depende de T018 (ver bloqueio acima) e homologação (S186).

## Dependencies & Execution Order

T001 antes de T002; US1 é MVP. Em cada US, testes de application e pgTAP precedem persistência/domínio, adapter e interface. US2 e US3 usam objetos da US1 com fixtures próprias para verificação independente. Sem execução paralela de alterações no mesmo domain/adapter/page/migration; testes US1 de application e SQL podem ser preparados em paralelo por estarem em arquivos distintos.

## Implementation Strategy

Entregar uma US por vez, provar seus AC em ambiente local e preservar caminho legado necessário. Verificar catálogo CT-024 e CT-027. Somente depois completar evidências e revisão adversarial; deploy/cobrança/Auvo real dependem da etapa operacional própria. Todos os AC têm teste e implementação; nenhuma task marcada como concluída nesta entrega.

