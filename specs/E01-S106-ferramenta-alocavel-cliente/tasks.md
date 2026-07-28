---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Ferramenta alocável em um cliente

## Plano
| #  | Task                                                             | Cobre AC | Depende de | Gate (comando)                          | Status |
|----|------------------------------------------------------------------|----------|------------|-----------------------------------------|--------|
| 1  | Migration: `pcm.ferramentas` (se não existir) + `pcm.ferramenta_alocacoes` (ferramenta_id, cliente_id, alocada_em, devolvida_em) + RLS FORCE | AC-1,AC-3 | — | `db-tests` verde (RLS) | todo   |
| 2  | Domínio: regra "uma alocação ativa por ferramenta" + histórico   | AC-1,AC-3,AC-4 | 1     | `pnpm test` (unit; conflito de alocação)| todo   |
| 3  | Adapter/CRUD de alocação/devolução                               | AC-1,AC-3 | 2          | `pnpm test` (integração)                | todo   |
| 4  | UI: alocar/devolver ferramenta a partir do cliente               | AC-1,AC-3,AC-4 | 3     | Playwright (fluxo alocar/devolver)      | todo   |
| 5  | UI: listar ferramentas alocadas no resumo do cliente             | AC-2     | 3          | Playwright (lista por cliente)          | todo   |

## Plano de teste
- Unidade: invariante "uma alocação ativa por ferramenta".
- Integração/RLS: acesso por papel.
- Aceite: Playwright para AC-1..AC-4.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] RLS FORCE; `db-tests` não pulado
- [ ] `docs/STATE.md` atualizado
