---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Contatos completos do cliente

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                     | Status |
|----|----------------------------------------------------------------------|----------|------------|--------------------------------------|--------|
| 1  | Migration: `email`, `telefone`, `preferencia_contato` em `pcm.cliente_responsaveis`; migrar `contato`→`telefone`; drop `contato` | AC-1,AC-3 | — | `lint:migrations`/squawk verde | todo |
| 2  | Domínio: `validarResponsavel` valida novos campos                    | AC-1,AC-2 | 1          | `pnpm test`                          | todo   |
| 3  | Gateway/adapter/aplicação atualizados                                | AC-1     | 1,2        | `pnpm test`                          | todo   |
| 4  | UI: painel de responsáveis ganha os campos novos                     | AC-1,AC-2 | 3          | typecheck + vitest                   | todo   |

## Plano de teste
- Unidade: validação de email (contém "@"), preferência de contato (enum fechado).
- Regressão: registros de E01-S103 continuam visíveis após migração de `contato`→`telefone`.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] `docs/STATE.md` atualizado
