---
name: tasks-E01-S96-fix-erro-generico-import-xls
description: Decomposição — propagar detail real do erro no import de XLS.
alwaysApply: false
---

# Tasks — Fix: erro genérico no import de XLS de Inspeção

## Plano
| #  | Task                                                                     | Cobre AC | Depende de | Gate (comando)      | Status |
|----|-----------------------------------------------------------------------------|----------|------------|---------------------|--------|
| 1  | Extrair `erroDetalhado` para `apps/web/src/lib/http/edge-function-error.ts` | AC-1, AC-2 | —        | `pnpm run typecheck` | done   |
| 2  | Usar o helper em `processarRelatorioInspecao`                              | AC-1     | Task 1     | `pnpm run typecheck` | done   |
| 3  | Teste unitário do helper (corpo JSON com `detail`, corpo não-JSON, sem `context`) | AC-1, AC-2 | Task 1 | `pnpm vitest run`  | done   |

## Plano de teste
- Unitário: `erroDetalhado` retorna `Error(detail)` quando o corpo tem `detail`; retorna o erro original quando o corpo não é JSON ou não tem `context`.

## Checklist de Definition of Done
- [x] AC-1/AC-2 verdes
- [x] `pnpm run ci:local` verde
- [x] `docs/STATE.md` + ROADMAP atualizados
