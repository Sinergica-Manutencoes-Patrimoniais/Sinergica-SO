# Tasks — E01-S174: Backlog canônico e conversões de escopo sem perda

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status** (auditoria de código em 2026-11-10, madrugada): **story essencialmente pronta**, tasks.md estava catastroficamente desatualizado. Realidade: **85 migrations** (0375→1449), **109 funções `pcm.sso_*` distintas** (composição, priorização GUTD, suspensão, interrupção, atribuição, reconciliação, continuação em cadeia, promoção parcial/integral, retornos privados/parciais). pgTAP oficial: `E01-S174_divisao_promocao_guardas.test.sql` (plan 24) em `db-tests`.
- `domain/backlog-escopo.ts` (72 linhas) + `backlog-escopo-us1.test.ts` (3) + `backlog-escopo-us2.test.ts` (3); `domain/priorizacao-backlog.ts` (150 linhas) + teste (23) — **nomes batem o plano exatamente**, diferente da maioria das stories auditadas hoje. Rodado de dentro de `apps/web/`: **29/29 passed**.
- UI: `pages/BacklogGutPage.tsx` (537 linhas), `components/PainelBacklog.tsx` (86 linhas), `interfaces/pendencias-tecnicas/PainelLateralBacklog.tsx` (AC-6, painel lateral compartilhado Kanban/360) compondo 5 subcomponentes atrás de feature flags.
- **AC-5** (devolver só restante): migration 1830 desta sessão (E01-S167) é **compatível** — alargou `pendencia_id` pra opcional e adicionou `origem='chamado_devolvido'` sem tocar nas colunas/constraints do fluxo original; sem colisão.
- **Hipótese não verificada / possível gap**: `application/backlog-escopo.ts` e `infrastructure/supabase-backlog-escopo-adapter.ts` planejados em T007/T012 **não existem com esse nome**; `BacklogGutPage.tsx` usa `supabaseHubOsAdapter`/`supabaseOrdemServicoAdapter` em vez disso, com só 1 chamada `.rpc(` direta — não confirmado quantos dos 109 RPCs têm chamador TS real. Antes de fechar T016, confirmar isso é a pergunta que decide se há gap de verdade ou só de rastreio.
- Não reimplementar. T014-T016 (integração/e2e/homologação) não confirmados.

## Phase 1 — Setup

- [ ] T001 Revalidar dependências e reuso em `specs/E01-S174-backlog-escopo-rastreavel/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S174_backlog_escopo.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S174 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S174-backlog-escopo-rastreavel/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Priorizar escopo selecionado sem criar execução

**Independent Test:** Agrupar duas falhas do ativo, recalcular GUTD e confirmar que fonte e outras cinco falhas permanecem.

- [ ] T004 [US1] Escrever teste unitário falho para persistir Backlog independente e composição de parcelas, priorização GUTD e decisões de risco/dispensa em `apps/web/src/features/pcm/domain/backlog-escopo-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/backlog-escopo-us1.test.ts` conforme `specs/E01-S174-backlog-escopo-rastreavel/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar persistir Backlog independente e composição de parcelas, priorização GUTD e decisões de risco/dispensa em `apps/web/src/features/pcm/domain/backlog-escopo.ts`, preservando constraints de `specs/E01-S174-backlog-escopo-rastreavel/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/backlog-escopo.ts` e `apps/web/src/features/pcm/infrastructure/supabase-backlog-escopo-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/backlog-escopo-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/backlog-escopo/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Promover e devolver somente restante

**Independent Test:** Promover parcialmente um Backlog, executar metade e suspender Chamado; comparar escopo que retorna e abrir painel no Kanban.

- [ ] T009 [US2] Escrever teste unitário falho para implementar promoção e devolução transacionais por parcela e painel lateral compartilhado com Kanban/360 em `apps/web/src/features/pcm/domain/backlog-escopo-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/backlog-escopo-us2.test.ts` conforme `specs/E01-S174-backlog-escopo-rastreavel/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar implementar promoção e devolução transacionais por parcela e painel lateral compartilhado com Kanban/360 em `apps/web/src/features/pcm/domain/backlog-escopo.ts`, preservando constraints de `specs/E01-S174-backlog-escopo-rastreavel/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/backlog-escopo.ts` e `apps/web/src/features/pcm/infrastructure/supabase-backlog-escopo-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/backlog-escopo-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/backlog-escopo/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-backlog-escopo-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/backlog-escopo.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S174-backlog-escopo-rastreavel/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S174-backlog-escopo-rastreavel/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S173, E01-S167, E01-S170 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Manter fila como status de OS; apagar fonte ao promover; transformar toda pendência em execução.
