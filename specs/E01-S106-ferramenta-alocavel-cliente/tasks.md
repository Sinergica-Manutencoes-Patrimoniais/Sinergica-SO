---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Ferramenta alocável em um cliente

## Plano
| #  | Task                                                             | Cobre AC | Depende de | Gate (comando)                          | Status |
|----|------------------------------------------------------------------|----------|------------|-----------------------------------------|--------|
| 1  | Migration: `pcm.ferramentas` já existia (E01-S65) — `pcm.ferramenta_alocacoes_cliente` (ferramenta_id, cliente_id, alocada_em, devolvida_em) + índice único parcial (1 ativa por ferramenta) + RLS FORCE | AC-1,AC-3 | — | `lint:migrations`/squawk verde | done |
| 2  | Domínio: regra "uma alocação ativa por ferramenta" + histórico   | AC-1,AC-3,AC-4 | 1     | `pnpm test` (unit; conflito de alocação)| done   |
| 3  | Adapter/CRUD de alocação/devolução                               | AC-1,AC-3 | 2          | `pnpm test` (integração)                | done   |
| 4  | UI: alocar/devolver ferramenta a partir do cliente               | AC-1,AC-3,AC-4 | 3     | Playwright (fluxo alocar/devolver)      | done   |
| 5  | UI: listar ferramentas alocadas no resumo do cliente             | AC-2     | 3          | Playwright (lista por cliente)          | done   |

## Plano de teste
- Unidade: invariante "uma alocação ativa por ferramenta".
- Integração/RLS: acesso por papel.
- Aceite: Playwright para AC-1..AC-4.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome/lint:migrations)
- [x] RLS FORCE; índice único parcial garante invariante no banco (não só na aplicação)
- [ ] `db-tests` (pgTAP) não pulado — pendente de Docker/CI
- [ ] Playwright rodado localmente pelo Lucas
- [ ] `docs/STATE.md` atualizado
