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
| 1  | Migration: `pcm.agenda_tecnico` (funcionario_id, cliente_id, data, hora) + RLS FORCE | AC-2 | — | `db-tests` verde (RLS)         | todo   |
| 2  | Domínio/adapter: CRUD de alocação + consulta por semana          | AC-2,AC-4,AC-5 | 1      | `pnpm test` (unit + integração)       | todo   |
| 3  | UI: board semanal (colunas por dia, navegação de semana)         | AC-1,AC-5  | 2          | Playwright (colunas + navegação)      | todo   |
| 4  | UI: "+" abre form (técnico, cliente, hora) e cria card           | AC-2,AC-3  | 3          | Playwright (criação aparece no dia)   | todo   |
| 5  | UI: cor por técnico consistente; card com nome + local           | AC-3       | 4          | Playwright (marcador consistente)     | todo   |
| 6  | UI: editar/remover card                                          | AC-4       | 4          | Playwright (edição/remoção)           | todo   |

## Plano de teste
- Unidade: consulta por semana (limites de data), ordenação por hora.
- Integração/RLS: acesso por papel.
- Aceite: Playwright para AC-1..AC-5.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Playwright rodado localmente (bate com a referência visual)
- [ ] RLS FORCE; `db-tests` não pulado
- [ ] `docs/STATE.md` atualizado
