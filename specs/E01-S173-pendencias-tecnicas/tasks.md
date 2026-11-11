# Tasks — E01-S173: Pendências técnicas atômicas, resultados e agrupamento por ativo

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status** (auditoria de código em 2026-11-10, madrugada): **story essencialmente pronta**, tasks.md estava gravemente desatualizado. Realidade: **33 migrations** (0341→1694), 4 pgTAP oficiais em `db-tests` (`consultas_mediadas` 21, `origem_pendencia_divergente` 3, `retorno_aprovado_fixture` 12 = 36 assertions), **65 componentes TSX + domain.ts** em `interfaces/pendencias-tecnicas/` (3836 linhas), `Workspace.tsx` (257 linhas) orquestrando tudo.
- **AC-1/AC-2/AC-3** (US1 — constatação → pendência rastreável): `domain/pendencias-tecnicas.ts` (85 linhas) + `pendencias-tecnicas-us1.test.ts` (154 linhas, 8 testes) — PASS de dentro de `apps/web/`. Migrations `0341`, `0371` (núcleo), `0380`, `0583-0605` (diagnóstico/criticidade/condição). UI: `ContextoTecnico.tsx`, `CriticidadePendencia.tsx`, `CondicoesNaoInformadas.tsx`, `ResolucaoHumana.tsx`.
- **AC-4/AC-5/AC-6** (US2 — consultar/decidir por ativo): `PendenciasDoAlvo.tsx` (132 linhas), `FiltroCriticidade.tsx`/`FiltroContextoTecnico.tsx` (AC-4), `SelecaoComposicao.tsx`+teste e `PreviaSelecao.tsx`+teste (AC-5, seleção parcial sem criar Chamado/OS automático), `RastreabilidadePendencia.tsx`/`DiagnosticoResolucao.tsx` (AC-6). 6 arquivos de teste rodados: 19/19 passed.
- **Gap real pequeno confirmado**: não existe `application/pendencias-tecnicas*.ts` dedicado — componentes chamam RPC direto (mesmo padrão aceito em S171); `infrastructure/supabase-pendencias-tecnicas-adapter.ts` existe (37 linhas, fino) mas sem `application/`. Pode ser aceitável (mesmo padrão de S171), não necessariamente bug.
- **Hipótese não verificada**: vínculo pendência→parcela→Backlog (`VinculoChamado.tsx`, único consumidor de `sso_vincular_pendencia_parcela`, S174) sem teste colocado dedicado a esse arquivo.
- Superfície extra não mapeada por AC literal (ciclos de devolução, continuação, GUTD, portal) pertence a decisões posteriores do Fabrício/S174 que se apoiam em S173 — não é gap, é escopo que cresceu depois da spec original.
- Não reimplementar. Ação recomendada: confirmar se a ausência de `application/` é aceitável antes de fechar T007.

## Phase 1 — Setup

- [ ] T001 Revalidar dependências e reuso em `specs/E01-S173-pendencias-tecnicas/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S173_pendencias_tecnicas.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S173 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S173-pendencias-tecnicas/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Transformar constatação em pendência rastreável

**Independent Test:** Receber execução com três Não OK, um Corrigido, um Não aplicável e obrigatório sem resposta; duplicar evento.

- [ ] T004 [US1] Escrever teste unitário falho para normalizar resultados explícitos por pergunta e upsert atômico de Pendência com origem/evidências, mantendo validação separada em `apps/web/src/features/pcm/domain/pendencias-tecnicas-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/pendencias-tecnicas-us1.test.ts` conforme `specs/E01-S173-pendencias-tecnicas/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar normalizar resultados explícitos por pergunta e upsert atômico de Pendência com origem/evidências, mantendo validação separada em `apps/web/src/features/pcm/domain/pendencias-tecnicas.ts`, preservando constraints de `specs/E01-S173-pendencias-tecnicas/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/pendencias-tecnicas.ts` e `apps/web/src/features/pcm/infrastructure/supabase-pendencias-tecnicas-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/pendencias-tecnicas-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/pendencias-tecnicas/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Consultar e decidir parcialmente por ativo

**Independent Test:** Abrir cartão com sete pendências, promover duas, aceitar risco de uma e manter cinco não promovidas rastreáveis.

- [ ] T009 [US2] Escrever teste unitário falho para agrupar cartões por alvo, filtrar e registrar decisões parciais com estado/origem preservados e contrato de promoção em `apps/web/src/features/pcm/domain/pendencias-tecnicas-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/pendencias-tecnicas-us2.test.ts` conforme `specs/E01-S173-pendencias-tecnicas/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar agrupar cartões por alvo, filtrar e registrar decisões parciais com estado/origem preservados e contrato de promoção em `apps/web/src/features/pcm/domain/pendencias-tecnicas.ts`, preservando constraints de `specs/E01-S173-pendencias-tecnicas/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/pendencias-tecnicas.ts` e `apps/web/src/features/pcm/infrastructure/supabase-pendencias-tecnicas-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/pendencias-tecnicas-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/pendencias-tecnicas/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-pendencias-tecnicas-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/pendencias-tecnicas.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S173-pendencias-tecnicas/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S173-pendencias-tecnicas/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S165, E01-S166, E01-S168 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Criar Chamado corretivo automático por Não OK; inferir Não OK de prosa; criar pendência aberta para Corrigido; executar questionário no SO nesta fase.
