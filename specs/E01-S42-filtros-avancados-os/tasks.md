---
name: tasks
description: Decomposição e gates — filtros avançados em Ordens de Serviço.
alwaysApply: false
---

# Tasks — Filtros avançados em Ordens de Serviço

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `domain/ordens-servico.ts`: `FiltrosOrdens` + `filtrarOrdens(ordens, filtros)` pura | AC-1 a AC-4 | — | `pnpm test` | done |
| 2  | `OrdensServicoPage.tsx`: estados `tecnicoFiltro`/`categoriaFiltro`/`dataInicio`/`dataFim`, UI dos selects/inputs, `limparFiltros()` | AC-1 a AC-4, AC-6 | 1 | manual | done |
| 3  | `calcularKpisOrdens` passa a receber `ordensFiltradas` em vez do total | AC-5 | 2 | `pnpm test` | done |
| 4  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-3 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Unidade: `filtrarOrdens` cobre cada filtro isolado + combinação (AC-1 a AC-4).
- Manual: aplicar todos os filtros juntos, conferir KPIs mudando.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
