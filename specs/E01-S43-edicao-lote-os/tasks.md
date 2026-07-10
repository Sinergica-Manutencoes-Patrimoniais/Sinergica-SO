---
name: tasks
description: Decomposição e gates — edição em lote de Ordens de Serviço.
alwaysApply: false
---

# Tasks — Edição em lote de Ordens de Serviço

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `application/hub-os.ts`: `alterarStatusEmLote(gateway, ids, status, updatedBy)` via `Promise.allSettled` | AC-2, AC-3 | — | `pnpm test` | done |
| 2  | `OrdensServicoPage.tsx`: estado `selecionados: Set<string>`, checkbox na Lista | AC-1, AC-4 | 1 | manual | done |
| 3  | `OsKanbanView.tsx`: checkbox no card + props de seleção | AC-1 | 1 | manual | done |
| 4  | Barra de ação em lote (contagem + select de status + aplicar) | AC-2, AC-3 | 2, 3 | manual | done |
| 5  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-4 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Unidade: `alterarStatusEmLote` — sucesso total, falha parcial isolada (AC-2, AC-3).
- Manual: selecionar OS em Lista e Kanban, aplicar status, trocar de view e conferir seleção limpa.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
