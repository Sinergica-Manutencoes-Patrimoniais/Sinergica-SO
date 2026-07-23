---
name: tasks-E01-S83-backlog-cadastro-observacao
description: Decomposição — backlog cadastro direto/origem inspeção + observação.
alwaysApply: false
---

# Tasks — Backlog + Observação

## Plano
| #  | Task                                                           | Cobre AC | Depende de | Gate (comando)        | Status |
|----|----------------------------------------------------------------|----------|------------|-----------------------|--------|
| 1  | Migration: `observacao text` + estado/flag de backlog em OS    | AC-1,4   | —          | `pnpm lint:migrations`| todo   |
| 2  | Domínio: item de backlog (sem data/OS) + validações            | AC-1,2   | 1          | `pnpm test`           | todo   |
| 3  | Cadastro direto de backlog no `BacklogGutPage`/modal           | AC-1     | 2          | browser               | todo   |
| 4  | Guardar que backlog não cria tarefa Auvo até planejar          | AC-2     | 2          | `pnpm test`           | todo   |
| 5  | Aceitar/expor origem-inspeção no item de backlog               | AC-3     | 2          | `pnpm test`           | todo   |
| 6  | Campo Observação no form + detalhe                             | AC-4     | 1          | browser               | todo   |

## Plano de teste
- Unidade: invariantes do item de backlog (sem data/sem vínculo Auvo).
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde; migration aditiva/nullable
- [ ] `docs/STATE.md` + ROADMAP atualizados
