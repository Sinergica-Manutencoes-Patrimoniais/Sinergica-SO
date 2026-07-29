---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Contatos completos do cliente

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                     | Status |
|----|----------------------------------------------------------------------|----------|------------|--------------------------------------|--------|
| 1  | Migration: `email`, `telefone`, `preferencia_contato` em `pcm.cliente_responsaveis`; migrar `contato`→`telefone`; drop `contato` | AC-1,AC-3 | — | `lint:migrations`/squawk verde | done |
| 2  | Domínio: `validarResponsavel` valida novos campos                    | AC-1,AC-2 | 1          | `pnpm test`                          | done   |
| 3  | Gateway/adapter/aplicação atualizados                                | AC-1     | 1,2        | `pnpm test`                          | done   |
| 4  | UI: painel de responsáveis ganha os campos novos                     | AC-1,AC-2 | 3          | typecheck + vitest                   | done   |

## Plano de teste
- Unidade: validação de email (contém "@"), preferência de contato (enum fechado) — 6 casos em
  `domain/cliente-responsaveis.test.ts`.
- Regressão: registros de E01-S103 continuam visíveis após migração de `contato`→`telefone`
  (`update ... set telefone = contato where contato is not null` antes do drop).

## Migrations
- `0161_E01-S111_cliente_responsaveis_contato_completo.sql` — aplicada em produção
  (`supabase db push --linked`).
- `0162_E01-S111_validar_preferencia_contato.sql` — VALIDATE CONSTRAINT, aplicada em produção.

## Divergências (SPEC_DEVIATION)
- [x] Task 1 · squawk (`ban-drop-column`) bloqueou o `drop column contato` · usado
  `-- squawk-ignore ban-drop-column` (mesmo padrão já usado em 0119) — dado já migrado pra
  `telefone` na linha anterior, e nenhum client em produção lê `contato` fora do adapter deste
  mesmo PR/deploy.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome/lint:migrations)
- [ ] `docs/STATE.md` atualizado
