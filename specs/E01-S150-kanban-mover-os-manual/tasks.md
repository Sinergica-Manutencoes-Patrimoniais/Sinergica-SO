---
name: E01-S150-kanban-mover-os-manual-tasks
description: Tasks da story E01-S150
alwaysApply: false
---

# Tasks — E01-S150

## Investigação (antes de codar)
Leitura estática de todo o caminho (RPC `fn_operacao_alterar_status_lote`, RLS de
`pcm.ordens_servico`, trigger `fn_registrar_os_status_evento`, view `pcm.operacao_itens`,
`deveAlterarStatusPorDrop`) não achou nenhuma restrição de transição — todas as 7 fases aceitam
mover pra qualquer outra. Pra não "consertar" um bug inexistente, testei ao vivo (dev server +
Playwright contra produção, usuário de teste real) antes de mudar código:

- **Dropdown "Alterar status" do painel de detalhe: funciona.** Planejamento → Em execução
  persistiu corretamente, confirmado por leitura fresca do painel após reload de estado.
- **Drag nativo HTML5 com `page.dragTo()` (helper de alto nível do Playwright): não disparava a
  RPC.** Achei que fosse bug do produto.
- **Drag simulado com sequência de mouse manual (mousedown → moves → mouseup, mais fiel ao gesto
  real): funcionou perfeitamente**, RPC disparou, card mudou de coluna, persistiu.

**Conclusão real**: o drag-and-drop nativo (HTML5 `draggable`, sem biblioteca) funciona no
produto, mas é frágil pra automação/trackpad — problema conhecido de UX com DnD nativo, não bug de
lógica/RLS/backend. Como o Lucas relatou não conseguir mover manualmente (provável trackpad no
Mac), a correção certa não é mexer no backend (já funciona) — é dar um jeito de mover que não
dependa do gesto de arrastar.

## Implementado
1. `OsKanbanView.tsx`: cada card do Kanban ganhou um `<select>` compacto (rodapé do card) que
   chama o mesmo `onAlterarStatus` já usado pelo drag e pelo dropdown do detalhe — mesma RPC,
   mesmo optimistic update, mesmo tratamento de erro. Guardado por `temEscrita` (mesma regra do
   drag). ✅
2. `aria-label` único por card (`Mover CH-XXXX para outra fase`) — acessível via teclado nativo
   (select HTML puro, sem necessidade de handler extra de teclado). ✅
3. Removido `onClick`/`stopPropagation` desnecessário (select é sibling do botão do card, não
   filho — lint `useKeyWithClickEvents` confirmou que não era preciso). ✅
4. `e2e/ordens-servico-kanban-status.spec.ts` novo — cobre mover Planejamento → Backlog via select
   e reverte ao final (não suja fixture pra outros specs). Roda contra produção real (mesmo padrão
   dos specs existentes de Kanban). ✅

## Fora de escopo desta iteração
- Não removi/mudei o drag nativo — continua funcionando (confirmado), só deixou de ser o único
  caminho.
- Histórico de mudança de status (`pcm.os_status_eventos`) já existe desde E01-S20 — não precisou
  de migration nova; exibir esse histórico na UI do card/detalhe fica pra story futura se pedido.

## Validação
- `pnpm run typecheck` verde.
- `biome check` verde.
- `vitest run src/features/pcm` — 464 passed.
- `pnpm vite build` verde.
- `npx playwright test e2e/kanban-colunas.spec.ts` — 1/2 verde (a falha é pré-existente: coluna
  "Preventiva" já estava oculta por preferência salva do usuário de teste em produção, não
  relacionado a esta mudança).
- `npx playwright test e2e/ordens-servico-kanban-status.spec.ts` — verde, contra produção real.
