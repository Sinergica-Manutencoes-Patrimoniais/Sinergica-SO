---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Responsável pelo cliente

## Plano
| #  | Task                                                           | Cobre AC       | Depende de | Gate (comando)                     | Status |
|----|----------------------------------------------------------------|----------------|------------|------------------------------------|--------|
| 1  | Migration: tabela `pcm.cliente_responsaveis` (cliente_id, nome, papel, contato) + RLS FORCE | AC-1,AC-2 | — | `db-tests` verde (RLS)      | todo   |
| 2  | Domínio/adapter: CRUD de responsáveis                          | AC-1,AC-2,AC-4 | 1          | `pnpm test` (unit + integração)    | todo   |
| 3  | UI: adicionar/editar/remover responsável no cadastro do cliente| AC-1,AC-2,AC-4 | 2          | Playwright (fluxo CRUD)            | todo   |
| 4  | UI: exibir responsáveis no resumo do cliente                   | AC-3           | 2          | Playwright (exibição)             | todo   |

## Plano de teste
- Unidade: validação de contato, papel.
- Integração/RLS: acesso restrito por papel (superadmin/supervisor/colaborador).
- Aceite: Playwright para AC-1..AC-4.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] RLS FORCE na tabela nova; `db-tests` não pulado
- [ ] `docs/STATE.md` atualizado
