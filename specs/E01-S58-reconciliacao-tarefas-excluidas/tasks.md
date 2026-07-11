---
name: tasks
description: Decomposição e gates — cancelar OS locais de tarefas excluídas no Auvo.
alwaysApply: false
---

# Tasks — Reconciliação de tarefas excluídas

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Verificar contrato real de `GET /tasks/GetDeletedTasks` com credencial (filtros de data, shape, id = `taskID`?) | todos | credencial Auvo | manual (curl) | todo |
| 2 | Etapa de reconciliação (janela incremental; mapear `auvo_task_id`→OS; cancelar com evento; regras AC-2/AC-3) + testes Deno | AC-1..3 | 1 | `deno test` | todo |
| 3 | Ligar em `pcm-auvo-sync-all` + cron (erro isolado por etapa, padrão existente) | AC-1 | 2 | `pnpm run check:edge-functions` | todo |
| 4 | Visibilidade do motivo na UI (evento na timeline de status já existente) | AC-4 | 2 | `pnpm run test` | todo |
| 5 | `pnpm run ci:local` + ROADMAP/STATE + teste manual (excluir tarefa de teste no Auvo, ver OS cancelar) | todos | 1-4 | `pnpm run ci:local` | todo |

## Plano de teste
- Deno: idempotência, OS finalizada não regride, OS sem correspondência ignorada.
- Manual: ciclo real com tarefa de teste.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
