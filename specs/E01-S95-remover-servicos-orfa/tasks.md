---
name: tasks-E01-S95-remover-servicos-orfa
description: Decomposição — remover ServicosPage.tsx órfã.
alwaysApply: false
---

# Tasks — Remover `ServicosPage` órfã

## Plano
| #  | Task                                                             | Cobre AC | Depende de | Gate (comando)        | Status |
|----|-------------------------------------------------------------------|----------|------------|-----------------------|--------|
| 1  | Confirmar zero referências a `ServicosPage` (código + e2e)        | AC-1     | —          | `grep -rl ServicosPage` | done |
| 2  | Deletar `apps/web/src/features/pcm/pages/ServicosPage.tsx`        | AC-1, AC-2 | Task 1   | `pnpm run build`       | done   |

## Plano de teste
- Aceite: `grep -rl ServicosPage apps/web/src` não retorna nada; build passa sem import quebrado.

## Checklist de Definition of Done
- [x] AC-1/AC-2 verdes
- [x] `pnpm run ci:local` verde
- [x] `docs/STATE.md` + ROADMAP atualizados
