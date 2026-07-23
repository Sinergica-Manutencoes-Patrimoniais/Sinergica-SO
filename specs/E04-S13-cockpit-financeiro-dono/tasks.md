---
name: tasks-E04-S13-cockpit-financeiro-dono
description: Decomposição — cockpit financeiro do dono.
alwaysApply: false
---

# Tasks — Cockpit financeiro do dono

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando) | Status |
|----|-------------------------------------------------------------|----------|------------|----------------|--------|
| 1  | Domínio: runway, break-even, ticket médio (funções puras)   | AC-1,2,4 | —          | `pnpm test`    | todo   |
| 2  | RPC server-side agregando caixa/projeção/margem            | AC-1,3,4 | E04-S03/S05/S06 | `pnpm test` | todo   |
| 3  | Ranking de margem por cliente (reusa E04-S06)              | AC-3     | 2          | `pnpm test`    | todo   |
| 4  | UI Cockpit (indicadores + tendências, gated gestão)        | AC-1,2,3,4,5 | 1,2,3  | browser        | todo   |

## Plano de teste
- Unidade: runway com burn negativo (sem div/0); amostra pequena; break-even.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [ ] AC-1..AC-5 verdes
- [ ] `pnpm run ci:local` verde; gráficos seguem skill `dataviz`
- [ ] Bloco reusável documentado para E08 (Gestão)
- [ ] `docs/STATE.md` + ROADMAP atualizados
