---
name: tasks-E01-S87-detalhe-equipamento-sistema-historico
description: Decomposição — visão detalhada de equipamento/sistema com histórico.
alwaysApply: false
---

# Tasks — Detalhe equipamento/sistema (histórico)

## Plano
| #  | Task                                                          | Cobre AC | Depende de | Gate (comando)  | Status |
|----|---------------------------------------------------------------|----------|------------|-----------------|--------|
| 1  | Domínio: agregação de histórico de OS por equipamento         | AC-1     | —          | `pnpm test`     | todo   |
| 2  | Domínio: histórico do sistema (agrega componentes, dedupe)    | AC-2     | 1          | `pnpm test`     | todo   |
| 3  | Adapter: query de OS por equipamento/sistema                  | AC-1,2   | 1,2        | `pnpm test`     | todo   |
| 4  | UI: seção Histórico no detalhe (última preventiva em destaque)| AC-1,2,3 | 3          | browser         | todo   |

## Plano de teste
- Unidade: ordenação por data, cálculo de "última preventiva", dedupe do sistema, estado vazio.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [ ] AC-1..AC-3 verdes
- [ ] `pnpm run ci:local` verde
- [ ] `docs/STATE.md` + ROADMAP atualizados
