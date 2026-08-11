---
name: tasks
description: Decomposição e gates — fluidez e performance do board de Chamados/OS.
alwaysApply: false
---

# Tasks — Fluidez e performance de Chamados

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|---|---|---|---|---|
| 1 | Baseline estrutural + ADR-0021 + migration `0178` com view/índices/KPIs | AC-3, AC-6, AC-8, AC-9, AC-10 | — | `pnpm run lint:migrations && supabase test db` | done local |
| 2 | RPC de status em lote com retorno individual e pgTAP | AC-7, AC-8 | 1 | `supabase test db` | done |
| 3 | `OperacaoGateway`, tipos de página/cursor e adapter Supabase cancelável | AC-1, AC-2, AC-4, AC-6 | 1 | `pnpm --filter @sinergica/web test -- operacao` | done |
| 4 | Instalar/configurar TanStack Query; hooks de feed/KPI/detalhe/catálogos | AC-3, AC-4, AC-5 | 3 | `pnpm --filter @sinergica/web test -- operacao` | done |
| 5 | Migrar Lista: ativos, busca server-side, skeleton e carregar mais | AC-1, AC-2, AC-3, AC-4, AC-5 | 4 | `pnpm --filter @sinergica/web test -- OrdensServicoPage` | done |
| 6 | Migrar Kanban/Timeline/Calendário/Backlog para queries limitadas | AC-2, AC-5, AC-6 | 4 | `pnpm --filter @sinergica/web test -- OrdensServicoPage` | done |
| 7 | Detalhe/catálogos lazy + optimistic status/lote e invalidação | AC-3, AC-7 | 4, 5, 6 | `pnpm --filter @sinergica/web test -- OrdensServicoPage` | done |
| 8 | E2E, marcas de performance, budgets e remoção do full-fetch da tela | AC-3, AC-4, AC-5, AC-9, AC-10 | 5, 6, 7 | `pnpm --filter @sinergica/web test:e2e -- chamados.spec.ts backlog-gut.spec.ts ordens-servico.spec.ts` | E2E pendente de migration no ambiente |
| 9 | Gates finais, ROADMAP/STATE e Graphify | todos | 1-8 | `pnpm run ci:local && pnpm run audit:esteira && pnpm run eval:spec` | em andamento |

## Plano de teste
- Unidade: cursores, mapeamento, filtros, query keys, cancelamento e optimistic rollback.
- Banco/pgTAP: `security_invoker`, RLS, união sem duplicação, visita excluída, ordem/cursor e lote.
- Integração React: última busca vence, dados anteriores persistem, lazy load e retry.
- Aceite: ativos, histórico, carregar mais, criação/conversão/cancelamento, Kanban e Backlog.
- Performance: requests, payload, long tasks e marcas do fluxo.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma.

## Evidências locais (2026-08-10)
- `pcm_operacao_performance.test.sql`: 17 assertions verdes.
- Web: 883 testes verdes; 9 skipped de integração preexistentes.
- Build: 700,19 KB gzip; crescimento E01-S145 de 19,97 KB gzip.
- Squawk da migration `0178`: zero issue.
- Gate global de migrations bloqueado por quatro alertas da `0174`, fora desta story.
- Suíte pgTAP global: 58 arquivos verdes; falha externa em `comercial_fundacao_rls.test.sql`.
- E2E escrito, não executado: o ambiente conectado ainda não possui a migration `0178`.
- Commits por task não criados: worktree já continha mudanças paralelas sobre os mesmos arquivos.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] ADR-0021 aprovado
- [ ] Migration aplicada antes do frontend
- [x] Bundle cresce no máximo 20 KB gzip
- [x] `docs/STATE.md` e Graphify atualizados
