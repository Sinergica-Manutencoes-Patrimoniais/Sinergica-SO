---
name: tasks
description: Decomposição e gates — deep-link cliente-360 → OS.
alwaysApply: false
---

# Tasks — Deep-link: itens do cliente-360 abrem a OS específica

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `PainelBacklog.tsx`/`PainelHistorico.tsx`: prop `onSelecionar?`, linha vira `<button>` | AC-1 | — | manual | done |
| 2  | `VisaoClientePage.tsx`: prop `onAbrirOs?`, repassa pra `PainelBacklog`/`PainelHistorico` e pro clique de evento `tipo==="os"` na timeline (aba Timeline + resumo compacto) | AC-1, AC-2 | 1 | manual | done |
| 3  | `OrdensServicoPage.tsx`: prop `osIdInicial?`, `useEffect` seleciona ao montar/mudar | AC-3 | — | manual | done |
| 4  | `HomePage.tsx`: estado `osDeepLink`, handler `abrirOsDoCliente`, wiring nos dois componentes | AC-1, AC-2, AC-3 | 2, 3 | manual | done |
| 5  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-4 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Manual: cliente com OS aberta/histórico → clicar → conferir navegação + painel aberto mesmo com filtro
  de status diferente ativo em Ordens de Serviço.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
