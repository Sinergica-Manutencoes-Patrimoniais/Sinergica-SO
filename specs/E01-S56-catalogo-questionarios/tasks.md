---
name: tasks
description: Decomposição e gates — catálogo de questionários + cobertura de checklist.
alwaysApply: false
---

# Tasks — Catálogo de questionários (checklists) no PCM

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Verificar contrato real de `GET /questionnaires` com credencial | todos | credencial Auvo | manual (curl) | todo |
| 2 | Migration `pcm.questionarios` (RLS FORCE, unique `auvo_id`, perguntas jsonb) | AC-1 | 1 | `pnpm run lint:migrations` | todo |
| 3 | Descriptor/pull + testes Deno | AC-1 | 2 | `deno test` | todo |
| 4 | Painel da OS: esperado × respondido (join com snapshot existente) | AC-2 | 3 | `pnpm run test` | todo |
| 5 | Dashboard: % OS concluídas com checklist (geral/por técnico) | AC-3 | 4 | `pnpm run test` | todo |
| 6 | pgTAP RLS + `pnpm run ci:local` + ROADMAP/STATE + validação manual | todos | 1-5 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: matching questionário↔resposta do snapshot, cálculo de cobertura.
- Manual: conferir contra o relatório Questionários do Auvo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
