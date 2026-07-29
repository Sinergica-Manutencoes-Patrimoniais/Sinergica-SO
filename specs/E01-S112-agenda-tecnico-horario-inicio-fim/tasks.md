---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Agenda do Técnico: horário de início e fim

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                | Status |
|----|----------------------------------------------------------------------|----------|------------|--------------------------------|--------|
| 1  | Migration: renomear `hora`→`hora_inicio`, adicionar `hora_fim time`  | AC-1     | —          | `lint:migrations`/squawk verde | todo   |
| 2  | Domínio: `validarAlocacao` valida fim ≥ início                       | AC-2     | 1          | `pnpm test`                    | todo   |
| 3  | Gateway/adapter/aplicação atualizados                                | AC-1     | 1          | typecheck + vitest             | todo   |
| 4  | UI: modal com 2 campos de hora; card mostra intervalo                | AC-1,AC-3 | 3         | typecheck + vitest             | todo   |

## Plano de teste
- Unidade: `validarAlocacao` rejeita fim < início; aceita só início; aceita nenhum dos dois.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] `docs/STATE.md` atualizado
