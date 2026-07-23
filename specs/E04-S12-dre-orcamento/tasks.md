---
name: tasks-E04-S12-dre-orcamento
description: Decomposição — DRE gerencial + orçamento anual.
alwaysApply: false
---

# Tasks — DRE + orçamento

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: orçamento por categoria/competência (RLS)        | AC-2     | E04-S01    | `pnpm lint:migrations`+pgTAP | done   |
| 2  | Domínio/RPC: DRE por competência (função pura + server-side) | AC-1,4  | —          | `pnpm test`                  | done   |
| 3  | Domínio: desvio orçado × realizado                         | AC-3     | 1,2        | `pnpm test`                  | done   |
| 4  | UI DRE (por mês) reusando gráficos de E04-S03              | AC-1     | 2          | browser                      | done   |
| 5  | UI Orçamento + comparativo realizado×orçado               | AC-2,3   | 1,3        | browser                      | done   |

## Plano de teste
- Unidade: agregação DRE por competência; desvio; categoria sem orçamento.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes
- [x] `pnpm run ci:local` verde; gráficos seguem skill `dataviz`
- [x] `docs/STATE.md` + ROADMAP atualizados
