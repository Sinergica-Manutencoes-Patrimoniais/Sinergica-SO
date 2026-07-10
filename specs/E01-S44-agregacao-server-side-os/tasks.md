---
name: tasks
description: Decomposição e gates — agregação server-side de Ordens de Serviço.
alwaysApply: false
---

# Tasks — Agregação 100% server-side de Ordens de Serviço

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0076`: RPC `pcm.fn_kpis_ordens_servico` (`security invoker`, grant `authenticated`) | AC-1, AC-5 | — | `pnpm run lint:migrations` | done |
| 2  | `hub-os-gateway.ts`: `FiltrosServidorOrdens`, `listarOrdensServico(filtros?)`, novo `contarKpis(filtros?)` | AC-1, AC-2 | 1 | typecheck | done |
| 3  | `supabase-hub-os-adapter.ts`: `buscarTodasOrdens` aplica filtros no `.eq/.gte/.lte`; `contarKpis` chama a RPC | AC-2, AC-5 | 2 | `pnpm test` | done |
| 4  | `hub-os.ts`: passthrough de `contarKpisOrdens` | AC-1 | 2 | `pnpm test` | done |
| 5  | `OrdensServicoPage.tsx`: refetch nos filtros server-side; KPIs via RPC quando sem busca, via `calcularKpisOrdens` quando com busca | AC-1, AC-3, AC-4 | 3, 4 | manual | done |
| 6  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-5 | `pnpm run ci:local` | done |

## Plano de teste
- Manual: aplicar filtro de status, conferir Network que a query tem `.eq`; comparar KPIs com/sem
  busca livre contra a lista visível.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] Migration aplicada em produção
- [ ] ROADMAP/STATE atualizados
