---
name: tasks-E01-S79-refinamentos-board-hub-os
description: Tasks — drag and drop no Board, edição no drawer, grid/tabela do Hub de OS.
alwaysApply: false
---

# Tasks — E01-S79: Refinamentos Board + Hub de OS

## Plano
| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Extrair `EquipamentoModal` de `EquipamentosPage.tsx` pra `components/EquipamentoModal.tsx` (compartilhado) | AC-2 | `pnpm typecheck` | ☑ |
| 2 | `DrawerDetalheAtivo.tsx`: botão "Editar" (só `pcm:escrita`), abre `EquipamentoModal`, salva via `editarEquipamento`, recarrega drawer + notifica board (`onAtualizado`) | AC-2 | `pnpm typecheck` | ☑ |
| 3 | `BoardAtivos.tsx`: drag and drop nativo HTML5 (mesmo padrão `OsKanbanView.tsx`) — `CardAtivo` arrastável, zonas de drop por coluna/subgrupo, `moverItem` reusa `editarEquipamento` só trocando `localId` | AC-1 | `pnpm typecheck` | ☑ |
| 4 | `OrdensServicoPage.tsx`: inverte grid da view "lista" pra `[360px_1fr]` (fila estreita fixa, `DetalheOs` flexível) | AC-3 | `pnpm build` | ☑ |
| 5 | `OrdensServicoPage.tsx`: converte a fila de `<div>` empilhado pra `<table>` (Nº/OS/Status/Prioridade), scroll horizontal próprio | AC-3 | `pnpm build` | ☑ |
| 6 | Estender `e2e/board-ativos.spec.ts` (edição via drawer + drag and drop) | AC-1, AC-2 | `pnpm exec playwright test board-ativos.spec.ts` | ☑ |
| 7 | ROADMAP + STATE (incluindo achados AS-IS do item 4, investigação) | — | `pnpm run ci:local` | ☑ |

## Plano de teste
- **Unidade (Vitest):** sem mudança de domínio/aplicação nesta story — cobertura existente
  (`equipamentos.test.ts`, `board-ativos.test.ts`) segue validando `editarEquipamento`/
  `montarColunasBoard`, que são reusados sem alteração de contrato.
- **Aceitação (Playwright, dev server local contra Supabase de produção — nunca Netlify):**
  `board-ativos.spec.ts` estendido cobre AC-1 (drag and drop move item de sub-local pra Local
  nível-1, confirma subgrupo some) e AC-2 (edita nome pelo drawer, confirma refletido no board).
  AC-3 verificado por leitura/typecheck/build (mudança puramente visual, sem lógica nova) — sem
  novo spec dedicado (tier pequeno, mesmo padrão de S75 pra ajustes de grid/densidade).

## SPEC_DEVIATION
(nenhum)

## Definition of Done
- [x] AC-1..AC-3 verdes (Playwright pra AC-1/AC-2, typecheck+build pra AC-3)
- [x] `pnpm run ci:local`-equivalente rodado manualmente: typecheck, lint (biome), test (426),
      build a confirmar
- [x] Playwright `board-ativos.spec.ts` + `ordens-servico.spec.ts` verdes no dev server local
- [x] ROADMAP + STATE atualizados · zero SPEC_DEVIATION pendente
