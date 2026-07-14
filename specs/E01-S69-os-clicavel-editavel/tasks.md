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
| 1 | `application/editar-ordem-servico.ts` (novo) + `EditarOrdemServicoInput` no gateway (`ordem-servico-gateway.ts` — deliberadamente menor que `CriarOrdemServicoInput`: sem cliente/origem/solicitante/tipo de tarefa, que não fazem sentido mudar depois de aberta); `supabase-ordem-servico-adapter.ts` ganha `.editarOrdemServico()` (`.update()`, RLS `pcm:escrita` já cobre — confirmado, sem policy nova). 3 testes | AC-1 | — | `pnpm run test` | **done** |
| 2 | `NovaOrdemServicoModal.tsx`: prop `ordem?: OrdemServicoOperacional` (+ `onEditada?`, `onCriada` virou opcional); quando presente, pré-preenche campos e submete via `editarOrdemServico`, título vira "Editar OS {numero}", esconde campos que não fazem sentido editar (Cliente/Solicitante/Origem/Tipo de tarefa/Localização — fora do AC-1). Trava a sugestão automática de prioridade (`prioridadeManual=true`) pra não sobrescrever o valor real ao abrir em edição | AC-1, AC-5 | 1 | `pnpm run test` | **done** |
| 3 | **Não foi preciso mexer em `OsKanbanView.tsx` — decisão de escopo.** O card já chama `onSelecionar` ao clicar (E01-S38), que já revela `DetalheOs` como painel lateral (Kanban/Timeline/Calendário todos compartilham `selecionada`). Bastou adicionar um botão "Editar" (só com `temEscrita`) no cabeçalho do `DetalheOs` (`OrdensServicoPage.tsx`) que abre `NovaOrdemServicoModal` em modo edição — cobre AC-2 sem tocar no componente do Kanban nem arriscar conflito com drag-and-drop (E01-S61) | AC-2 | 2 | `pnpm run test` | **done (via DetalheOs, não via OsKanbanView)** |
| 4 | `BacklogGutPage.tsx`: linha ganha `onClick` (abre `NovaOrdemServicoModal` local, estado `editando`); botão "Planejar" com `event.stopPropagation()`; linha agora mostra descrição (2 linhas, `line-clamp-2`), técnico e data prevista — dados já em `OrdemServicoOperacional`, sem query nova | AC-3, AC-4 | 2 | `pnpm run test` | **done** |
| 5 | `OrdensServicoPage.tsx` (Lista): mesmo botão "Editar" do `DetalheOs` (task 3) já cobre a Lista — `DetalheOs` é renderizado tanto na visão Kanban/Timeline/Calendário quanto na Lista (mesmo componente, 2 call sites). Nenhum painel novo criado (AC-5) | AC-5 | 2 | `pnpm run test` | **done (mesmo caminho da task 3)** |
| 6 | Gates + ROADMAP/STATE | todos | 1-5 | `biome check --write .`, `typecheck`, `test` (332 passando), `build`, `arch:check`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid` | **done, todos verdes** — verificação visual (clique durante drag não abre modal; leitura não edita) não realizada em browser, sem Playwright neste ambiente |

## Plano de teste
- Unit: `editarOrdemServico` (validação, campos atualizados); guarda de clique vs drag (função pura
  se extraída, senão teste de componente).
- Playwright: editar pelo Kanban e pelo Backlog; confirmar que arrastar/status/planejar seguem OK.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (clique durante drag não abre
  modal; leitura não edita) · ROADMAP/STATE atualizados
