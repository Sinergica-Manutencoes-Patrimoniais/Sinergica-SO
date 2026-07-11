---
name: tasks
description: Decomposição e gates — espelho de pesquisa de satisfação Auvo.
alwaysApply: false
---

# Tasks — Pesquisa de satisfação do Auvo no PCM

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Verificar contrato real de `/satisfactionsurveys` com credencial (a conta tem 0 respostas — validar shape com resposta de teste se possível) | todos | credencial Auvo | manual (curl) | todo |
| 2 | Migration `pcm.satisfacao_respostas` (RLS FORCE, unique `auvo_id`, vínculo OS por `auvo_task_id`) | AC-1 | 1 | `pnpm run lint:migrations` | todo |
| 3 | Pull (descriptor ou função dedicada — resposta é série, não CRUD) + testes Deno | AC-1 | 2 | `deno test` | todo |
| 4 | 360: média + últimas respostas + destaque detrator; estado vazio honesto | AC-2, AC-3, AC-4 | 3 | `pnpm run test` | todo |
| 5 | pgTAP RLS + `pnpm run ci:local` + ROADMAP/STATE | todos | 1-4 | `pnpm run ci:local` | todo |
| 6 | Pendência humana: ativar a pesquisa na config do Auvo (operação/Lucas) — registrar no STATE | AC-3 | — | manual | todo |

## Plano de teste
- Unit: vínculo task→OS, limiar de detrator, estado vazio.
- Manual: ativar pesquisa, responder 1, conferir chegada no PCM.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
