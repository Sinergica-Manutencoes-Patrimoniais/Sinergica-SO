---
name: tasks
description: Decomposição e gates — widgets analíticos avançados do painel.
alwaysApply: false
---

# Tasks — Widgets analíticos avançados do painel

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Estender snapshot/gateway (E02-S10) com séries: volume/dia, SLA, distribuição horária, throughput, carga | AC-1,AC-2,AC-3,AC-4 | — | test do gateway/adapter | done |
| 2  | Card Volume por dia | AC-1 | 1 | test de componente | done |
| 3  | Card SLA & entrega | AC-2 | 1 | test de componente | done |
| 4  | Card Heatmap por hora | AC-3 | 1 | test de componente | done |
| 5  | Cards Throughput e Carga por atendente | AC-4 | 1 | test de componente | done |
| 6  | `pnpm run ci:local` + comparação com prints heziomos + ROADMAP/STATE | todos | 1–5 | `pnpm run ci:local` | done |

## Plano de teste
- Componente: cada card com dataset sintético (série, vazio, atendente-zero).
- Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Paridade visual conferida contra o heziomos
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
