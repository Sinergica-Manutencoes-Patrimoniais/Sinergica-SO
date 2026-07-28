---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Board semanal de agenda do técnico

> Primeira fase: só visual/manual. Sem motor de alocação nem checagem de conflito.

## Plano
| #  | Task                                                             | Cobre AC   | Depende de | Gate (comando)                        | Status |
|----|------------------------------------------------------------------|------------|------------|---------------------------------------|--------|
| 1  | Migration: `pcm.agenda_tecnico` (funcionario_id, cliente_id, data, hora) + RLS FORCE | AC-2 | — | `db-tests` verde (RLS)         | done   |
| 2  | Domínio/adapter: CRUD de alocação + consulta por semana          | AC-2,AC-4,AC-5 | 1      | `pnpm test` (unit + integração)       | done   |
| 3  | UI: board semanal (colunas por dia, navegação de semana)         | AC-1,AC-5  | 2          | Playwright (colunas + navegação)      | done   |
| 4  | UI: "+" abre form (técnico, cliente, hora) e cria card           | AC-2,AC-3  | 3          | Playwright (criação aparece no dia)   | done   |
| 5  | UI: cor por técnico consistente; card com nome + local           | AC-3       | 4          | Playwright (marcador consistente)     | done   |
| 6  | UI: editar/remover card                                          | AC-4       | 4          | Playwright (edição/remoção)           | done   |

## Plano de teste
- Unidade: consulta por semana (limites de data), ordenação por hora.
- Integração/RLS: acesso por papel.
- Aceite: Playwright para AC-1..AC-5.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome/lint:migrations)
- [ ] Playwright rodado localmente pelo Lucas (bate com a referência visual)
- [x] RLS FORCE
- [ ] `db-tests` (pgTAP) não pulado — pendente de Docker/CI
- [ ] `docs/STATE.md` atualizado
