---
name: tasks-0001-priorizacao-backlog-gut
description: Decomposição e gates da priorização de backlog por GUT. Puxe ao implementar ou auditar a rastreabilidade.
alwaysApply: false
---

# Tasks — Priorização de Backlog por Matriz GUT

> Feature: domínio puro (sem I/O). Todos os gates são `pnpm --filter @sinergica/web test`.
> Status geral: **implementado e verde**.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Modelar `FatorGut` (tipo 1\|2\|3\|4\|5) e `calcularScoreGut` com validação | AC-1, AC-2 | — | `pnpm --filter @sinergica/web test` | ✅ done |
| 2 | Modelar `PrioridadeBacklog` e `classificarPrioridade(score)` com faixas | AC-3 | 1 | `pnpm --filter @sinergica/web test` | ✅ done |
| 3 | Implementar `ordenarPorPrioridade(itens)` — sort estável por score desc, sem mutação | AC-4 | 1 | `pnpm --filter @sinergica/web test` | ✅ done |

## Plano de teste
- **Unidade** (`priorizacao-backlog.test.ts`):
  - AC-1: `calcularScoreGut(5,5,5) === 125`, `(3,4,2) === 24`, min=1.
  - AC-2: 0, 6, 1.5 → `RangeError`; mensagem identifica o fator.
  - AC-3: score 125 → `"critica"`, 50 → `"alta"`, 20 → `"media"`, 1 → `"baixa"`.
  - AC-4: ordena por score desc; empate mantém ordem de entrada; não muta.

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [x] AC-1, AC-2, AC-3, AC-4 verdes pelo gate `pnpm --filter @sinergica/web test`
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Domínio puro (sem I/O, sem framework, sem importação de fora de `domain/`)
- [x] Glossário atualizado (`FatorGut`, `ScoreGut`, `PrioridadeBacklog`)
- [ ] `docs/STATE.md` atualizado (ao fechar esta task)
