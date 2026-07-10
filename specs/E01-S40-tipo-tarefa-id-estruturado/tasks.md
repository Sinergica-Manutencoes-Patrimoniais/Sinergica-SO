---
name: tasks
description: Decomposição e gates — tipo_tarefa_id estruturado + resolução real do taskType no Auvo.
alwaysApply: false
---

# Tasks — `tipo_tarefa_id` estruturado + resolução real do taskType no Auvo

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0073`: `tipo_tarefa_id uuid` + FK `NOT VALID` + índice | AC-5 | — | `pnpm run lint:migrations` | done |
| 2  | Migration `0074`: `VALIDATE CONSTRAINT` | AC-5 | 1 | `pnpm run lint:migrations` | done |
| 3  | `supabase-ordem-servico-adapter.ts`: `criarOrdemServico` grava `tipo_tarefa_id`/`tecnico_funcionario_id`/`data_agendada` como colunas reais | AC-1, AC-4 | 1 | `pnpm test` | done |
| 4  | `pcm-auvo-create-task/index.ts`: `select` inclui `tipo_tarefa_id`; resolução em cascata (tipo→categoria→falha) | AC-1, AC-2, AC-3 | 3 | leitura cuidadosa (sem Deno CLI local) | done |
| 5  | `pnpm run ci:local` + aplicar migration no Supabase de produção + ROADMAP/STATE | todos | 1-4 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Migration: `lint:migrations` (Squawk) verde nas duas.
- Manual (dev local + Supabase produção): criar OS com tipo de tarefa X, planejar, conferir
  `auvo_task_id` preenchido e (via GET direto no Auvo) `taskTypeId` correto.
- Regressão: OS criada sem tipo (fluxo antigo/import) continua indo pro Auvo via fallback de categoria.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] Migration aplicada em produção sem erro
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
