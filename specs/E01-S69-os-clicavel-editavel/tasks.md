---
name: tasks
description: Decomposição e gates — OS clicável/editável no Kanban, Backlog e Lista.
alwaysApply: false
---

# Tasks — E01-S69 · OS clicável e editável

> Marcar owner no ROADMAP. Branch: `feat/E01-S69-os-clicavel-editavel`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | `application/editar-ordem-servico.ts` + porta no gateway; adapter `supabase-hub-os-adapter.ts` ganha `.update()` (RLS `pcm:escrita` já existe). Validação de domínio reusa a de `abrir-ordem-servico`/`ordens-servico.ts`. Testes unit | AC-1 | — | `pnpm run test` | todo |
| 2 | `NovaOrdemServicoModal.tsx`: prop `ordem?: OrdemServicoOperacional`; quando presente, pré-preenche campos e submete via `editarOrdemServico`; título muda para "Editar OS". Sem `ordem`, comportamento atual (criar) | AC-1, AC-5 | 1 | `pnpm run test` | todo |
| 3 | `OsKanbanView.tsx`: clique no corpo do card abre o modal de edição (guarda pra não disparar durante drag nem no `<select>` de status — usar `onClick` no cabeçalho/título, não no container do draggable). Gate leitura/escrita | AC-2 | 2 | `pnpm run test` | todo |
| 4 | `BacklogGutPage.tsx`: linha clicável abre o modal; botão "Planejar" com `stopPropagation`; exibir descrição/técnico/data prevista (dados de `detalhes`) | AC-3, AC-4 | 2 | `pnpm run test` | todo |
| 5 | `OrdensServicoPage.tsx` (Lista): botão/linha abre o mesmo modal de edição; reusar `DetalheOs` como base (não duplicar) | AC-5 | 2 | `pnpm run test` | todo |
| 6 | `pnpm run ci:local` + Playwright (abrir card→editar→salvar; abrir backlog→editar; planejar não abre detalhe) + ROADMAP/STATE | todos | 1-5 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: `editarOrdemServico` (validação, campos atualizados); guarda de clique vs drag (função pura
  se extraída, senão teste de componente).
- Playwright: editar pelo Kanban e pelo Backlog; confirmar que arrastar/status/planejar seguem OK.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (clique durante drag não abre
  modal; leitura não edita) · ROADMAP/STATE atualizados
