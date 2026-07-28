---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Responsável pelo cliente

## Plano
| #  | Task                                                           | Cobre AC       | Depende de | Gate (comando)                     | Status |
|----|----------------------------------------------------------------|----------------|------------|------------------------------------|--------|
| 1  | Migration: tabela `pcm.cliente_responsaveis` (cliente_id, nome, papel, contato) + RLS FORCE | AC-1,AC-2 | — | `lint:migrations`/squawk verde | done |
| 2  | Domínio/adapter: CRUD de responsáveis                          | AC-1,AC-2,AC-4 | 1          | `pnpm test` (4 testes novos)        | done   |
| 3  | UI: adicionar/editar/remover responsável (painel na aba Resumo do cliente) | AC-1,AC-2,AC-4 | 2 | typecheck + vitest verdes | done |
| 4  | UI: exibir responsáveis no resumo do cliente                   | AC-3           | 2          | typecheck + vitest verdes           | done   |

## Plano de teste
- Unidade: validação de nome obrigatório, papel/contato opcionais.
- Integração/RLS: não rodado (sem Docker local — mesma limitação já registrada).
- Aceite: Playwright não rodado (pendente teste local do Lucas).

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome/lint:migrations)
- [x] RLS FORCE na tabela nova
- [ ] `db-tests` (pgTAP) não pulado — pendente de Docker/CI
- [ ] Playwright rodado localmente pelo Lucas
- [ ] `docs/STATE.md` atualizado
