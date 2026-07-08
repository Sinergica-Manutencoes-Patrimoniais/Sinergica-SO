---
name: tasks
description: Decomposição e gates — painel operacional de Atendimento.
alwaysApply: false
---

# Tasks — Painel operacional de Atendimento

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Seletor de período (Hoje/7d/30d) + fetch do snapshot via gateway de E02-S10 | AC-5 | — | test de componente | done |
| 2  | KPI strip 6 cards (`Fila sem atendente`, `Abertas`, `Não lidas`, `Mais antiga`, `1ª resposta`, `Abertas hoje`+delta) | AC-1 | 1 | test de componente (valores do snapshot) | done |
| 3  | Card "Saúde da fila" (aging buckets 0-1h/1-4h/4-24h/+24h) | AC-2 | 1 | test de componente | done |
| 4  | Card "IA — autonomia e escalonamento" (donut + escalou + IA no período + deflexão) | AC-3 | 1 | test de componente | done |
| 5  | Cards "CSAT" e "Mix de canal" | AC-4 | 1 | test de componente | done |
| 6  | Estados vazio/loading/percentual nulo | AC-1,AC-2,AC-3,AC-4 | 2–5 | test de componente (dataset vazio) | done |
| 7  | `pnpm run ci:local` + comparação lado a lado com prints heziomos + ROADMAP/STATE | todos | 1–6 | `pnpm run ci:local` | done |

## Plano de teste
- Componente: cada widget com dataset sintético (valores, estado vazio, nulo).
- Aceite: 1 por AC, conferindo layout contra os prints do heziomos (dev local, nunca prod Netlify).

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Paridade visual conferida contra o heziomos
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
