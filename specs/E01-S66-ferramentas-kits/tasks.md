---
name: tasks
description: Decomposição e gates — Kits de ferramentas (agrupamento PCM-only, atribuição/devolução em lote).
alwaysApply: false
---

# Tasks — E01-S66 · Kits de ferramentas

> Depende de E01-S63 mergeada. Marcar owner no ROADMAP. Branch: `feat/E01-S66-ferramentas-kits`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E01-S66_kits.sql`: `pcm.kits`, `pcm.kit_itens` (kit_id, ferramenta_id, quantidade), coluna `kit_atribuicao_id uuid` em `ferramenta_movimentacoes` (S63) — RLS FORCE padrão | AC-1, AC-2 | S63 | `pnpm run lint:migrations` | todo |
| 2 | `domain/kits.ts`: cálculo de "completo/incompleto" (estoque disponível × composição), atribuição tudo-ou-nada, agrupamento por `kit_atribuicao_id` — puro, testes | AC-1, AC-2, AC-4 | 1 | `pnpm run test` | todo |
| 3 | RPC/transação: atribuir kit (aloca N unidades atomicamente, rollback se faltar 1) — `security definer` avaliado × transação simples do adapter (decidir na implementação; tudo-ou-nada é o requisito, não a técnica) | AC-2, AC-3 | 2 | `pnpm run test` | todo |
| 4 | Use cases + adapter: CRUD kit, atribuir, devolver em lote, detectar kit incompleto | AC-1–AC-5 | 3 | `pnpm run test` | todo |
| 5 | `KitsPage`: lista de kits (com indicador completo/incompleto), form de composição, atribuir/devolver | AC-1, AC-2, AC-3, AC-5 | 4 | `pnpm run test` | todo |
| 6 | `FerramentasPorTecnicoPage` (já tocada na S63) ganha agrupamento visual por kit quando `kit_atribuicao_id` presente + aviso de kit incompleto (AC-4) | AC-4 | 4 | `pnpm run test` | todo |
| 7 | pgTAP: atribuição tudo-ou-nada realmente não deixa estado parcial em caso de falha | AC-2 | 1, 3 | CI `db-tests` | todo |
| 8 | `pnpm run ci:local` + Playwright (criar kit→atribuir→devolver, kit incompleto bloqueia atribuição) + ROADMAP/STATE | todos | 1–7 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: kit incompleto (falta 1 unidade de 1 item) não atribui nada.
- pgTAP: falha no meio da transação não deixa 2 de 3 itens atribuídos.
- Playwright: ciclo completo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (editar composição com kit
  já atribuído — AC-5 não deve mexer no passado) · ROADMAP/STATE atualizados
