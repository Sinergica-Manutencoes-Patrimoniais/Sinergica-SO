---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Agenda do Técnico: horário de início e fim

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                | Status |
|----|----------------------------------------------------------------------|----------|------------|--------------------------------|--------|
| 1  | Migration: renomear `hora`→`hora_inicio`, adicionar `hora_fim time`  | AC-1     | —          | `lint:migrations`/squawk verde | done   |
| 2  | Domínio: `validarAlocacao` valida fim ≥ início                       | AC-2     | 1          | `pnpm test`                    | done   |
| 3  | Gateway/adapter/aplicação atualizados                                | AC-1     | 1          | typecheck + vitest             | done   |
| 4  | UI: modal com 2 campos de hora; card mostra intervalo                | AC-1,AC-3 | 3         | typecheck + vitest             | done   |

## Plano de teste
- Unidade: `validarAlocacao` rejeita fim < início, rejeita fim sem início, aceita só início, aceita
  fim igual ao início, aceita nenhum dos dois — 5 casos em `domain/agenda-tecnico.test.ts`.
- UI: `AlocacaoModal` replica a mesma validação no cliente (feedback antes do round-trip, AC-2).

## Migrations
- `0163_E01-S112_agenda_tecnico_hora_inicio_fim.sql` — aplicada em produção
  (`supabase db push --linked`). Rename (não drop) preserva o dado existente.

## Divergências (SPEC_DEVIATION)
- [x] Task 1 · squawk (`renaming-column`) flagaria o rename · usado `-- squawk-ignore
  renaming-column` — nenhum client em produção lê `hora` fora do adapter atualizado no mesmo
  PR/deploy; dado preservado (rename, não drop).
- [x] Caso de borda do spec.md ("só fim preenchido, sem início") resolvido como **inválido**
  (opção B do spec: "ou exigir início quando fim for informado") — mensagem "Informe o horário de
  início junto com o de fim."

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome/lint:migrations)
- [ ] `docs/STATE.md` atualizado
