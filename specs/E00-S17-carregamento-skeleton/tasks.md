---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Estados de carregamento: skeleton e resposta imediata

## Plano
| #  | Task                                                                     | Cobre AC | Depende de | Gate (comando)                            | Status |
|----|--------------------------------------------------------------------------|----------|------------|--------------------------------------------|--------|
| 1  | `Skeleton.tsx` (bloco, linha, círculo) + shimmer respeitando reduced-motion | AC-1   | —          | `pnpm run test -- ui/Skeleton`             | todo   |
| 2  | `useCargaVisivel` — delay 200ms para mostrar, mínimo 400ms exibido       | AC-2     | 1          | `pnpm run test -- carga-visivel`           | todo   |
| 3  | `loading` do `DataTable` renderiza linhas fantasma na largura real       | AC-1     | 1          | `pnpm run test -- ui/DataTable`            | todo   |
| 4  | `EmptyState` ganha modo `vazio` × `filtrado` com ação distinta           | AC-6     | —          | `pnpm run test -- ui/EmptyState`           | todo   |
| 5  | `:active scale(0.97)` no `Button` + `loading` no mesmo frame do clique   | AC-4     | —          | `pnpm run test -- ui/Button`               | todo   |
| 6  | Padrão "recarga sem destruir" (mantém dado + indicador sutil)            | AC-3     | 1,2        | `pnpm run test -- recarga-preserva`        | todo   |
| 7  | `scripts/check-reticencia.mjs` (`...` em string de UI = 0)               | AC-5     | —          | `node scripts/check-reticencia.mjs`        | todo   |
| 8  | Codemod `...` → `…` em todo texto de interface                          | AC-5     | 7          | `node scripts/check-reticencia.mjs`        | todo   |
| 9  | Migrar telas PCM (maior volume) para skeleton `[P]`                     | AC-1, AC-3 | 1,2,3,6  | `pnpm run test -- pcm/carregamento`        | todo   |
| 10 | Migrar telas Financeiro `[P]`                                            | AC-1, AC-3 | 1,2,3,6  | `pnpm run test -- financeiro/carregamento` | todo   |
| 11 | Migrar Atendimento + Config + Área do Cliente `[P]`                      | AC-1, AC-3 | 1,2,3,6  | `pnpm run test -- atendimento/carregamento`| todo   |
| 12 | `scripts/check-carregando.mjs` (texto "Carregando" renderizado = 0)      | AC-1     | 9,10,11    | `node scripts/check-carregando.mjs`        | todo   |
| 13 | Playwright: filtro não volta ao skeleton e preserva scroll               | AC-3     | 6,9        | `pnpm run e2e -- recarga`                  | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: `useCargaVisivel` não mostra abaixo de 200ms e sustenta 400ms; `EmptyState`
  diferencia vazio de filtrado; `Button` aplica `:active` no `pointerdown`.
- Contrato (estático): 0 `...` em texto de UI; 0 "Carregando" renderizado.
- Aceite: Playwright — aplicar filtro mantém conteúdo e scroll; falha de rede mostra
  "Tentar de novo".

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Checkers no pre-push
- [ ] `docs/STATE.md` atualizado
