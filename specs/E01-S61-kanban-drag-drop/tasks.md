---
name: tasks
description: Decomposição e gates — drag-and-drop no Kanban de OS.
alwaysApply: false
---

# Tasks — Kanban: arrastar card muda status

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | `OsKanbanView.tsx`: cards ganham `draggable`/`onDragStart` (só com `temEscrita`); colunas ganham `onDragOver`/`onDrop` chamando `onAlterarStatus`; ignora drop na coluna de origem | AC-1, AC-3, AC-4 | — | `pnpm run typecheck` | done |
| 2 | Realce visual da coluna-alvo durante `dragover` | AC-2 | 1 | manual | done |
| 3 | Confirmar `<select>` intacto (nenhuma remoção) | AC-6 | 1 | `pnpm run test` | done |
| 4 | Teste de domínio/estrutural cobrindo handlers de drag (sem lib de simulação de DnD — testar a função pura que decide se dispara `onAlterarStatus`) | AC-1, AC-4 | 1 | `pnpm run test` | done |
| 5 | Gates de código + ROADMAP/STATE | todos | 1-4 | typecheck/test/build/arch:check/audit:esteira | done |
| 6 | Validação manual (arrastar de verdade num browser autenticado) | AC-1, AC-2 | 1-4 | manual em dev server | pending — precisa de credencial real (sem auth bypass desde E00-S05); código revisado linha a linha, não testado visualmente nesta sessão |

## Plano de teste
- Unit: função pura `deveAlterarStatus(origem, destino)` — só dispara se diferentes.
- Manual: arrastar card entre colunas no browser, conferir persistência (reload).

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [x] AC-1, AC-3, AC-4, AC-5, AC-6 verdes por código/teste
- [ ] AC-2 (realce visual) — implementado, não visualizado em browser autenticado
- [x] Gates de código verdes (typecheck, 289 testes, build, arch:check, audit:esteira)
- [x] ROADMAP/STATE atualizados
