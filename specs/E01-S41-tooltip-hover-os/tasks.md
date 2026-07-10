---
name: tasks
description: Decomposição e gates — tooltip de hover em OS + esclarecimento do CH-XXXX.
alwaysApply: false
---

# Tasks — Tooltip de hover em OS + CH-XXXX

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Novo `apps/web/src/components/ui/Tooltip.tsx` — hover+foco, delay, posicionamento por `getBoundingClientRect()` | AC-1, AC-2, AC-3 | — | typecheck | done |
| 2  | Plugar em `OrdensServicoPage.tsx` (Lista) e `OsKanbanView.tsx` | AC-1, AC-2 | 1 | manual | done |
| 3  | Trocar `title` nativo por `Tooltip` em `OsTimelineView.tsx`/`OsCalendarioView.tsx` | AC-1, AC-2 | 1 | manual | done |
| 4  | Plugar em `BacklogGutPage.tsx` | AC-1, AC-2 | 1 | manual | done |
| 5  | Tooltip no `CH-XXX` (lista + painel de detalhe) | AC-4 | 1 | manual | done |
| 6  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-5 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Manual (dev local): hover/foco em card de cada uma das 4 telas; hover no CH-XXX.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
