---
name: tasks-E04-S11-exportacao-contabil-fechamento
description: Decomposição — exportação contábil + fechamento mensal.
alwaysApply: false
---

# Tasks — Exportação + fechamento

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: fechamento por competência + eventos append-only | AC-2,3   | E04-S01    | `pnpm lint:migrations`+pgTAP | todo   |
| 2  | Guarda de "mês fechado" nas escritas de lançamento          | AC-2     | 1          | `pnpm test`+pgTAP            | todo   |
| 3  | Exportação CSV/Excel do período (mesma fonte do dashboard)  | AC-1,4   | —          | `pnpm test`                  | todo   |
| 4  | UI: exportar + fechar/reabrir mês                          | AC-1,2,3 | 1,3        | browser                      | todo   |

## Plano de teste
- Unidade: bloqueio de escrita em mês fechado; reabertura auditável; totais batem com dashboard.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde
- [ ] `docs/STATE.md` + ROADMAP atualizados
