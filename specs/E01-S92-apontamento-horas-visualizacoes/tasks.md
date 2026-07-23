---
name: tasks-E01-S92-apontamento-horas-visualizacoes
description: Decomposição — visualizações de apontamento de horas.
alwaysApply: false
---

# Tasks — Visualizações de apontamento de horas

## Plano
| #  | Task                                                           | Cobre AC | Depende de | Gate (comando)  | Status |
|----|----------------------------------------------------------------|----------|------------|-----------------|--------|
| 1  | Domínio: agregações (produtividade/dia, 3 fontes, anomalia, cliente) | AC-1,2,3,4 | — | `pnpm test apontamento` | done |
| 2  | Visualização produtividade diária vs meta                      | AC-1     | 1          | browser         | done   |
| 3  | Visualização consistência 3 fontes + tolerância                | AC-2     | 1          | browser         | done   |
| 4  | Visualização anomalias de duração                              | AC-3     | 1          | browser         | done   |
| 5  | Visualização horas por cliente                                 | AC-4     | 1          | browser         | done   |
| 6  | Parâmetros configuráveis (meta/tolerância/limiar) na Config     | AC-1,2,3 | 1,E01-S80  | browser         | done   |

## Plano de teste
- Unidade: cada agregação (casos de divergência, fonte ausente, técnico sem OS).
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes
- [x] `pnpm run ci:local` verde; visualizações acessíveis sem depender só de cor
- [x] `docs/STATE.md` + ROADMAP atualizados
