---
name: tasks
description: Decomposição e gates — unidades individuais de ferramenta + histórico append-only.
alwaysApply: false
---

# Tasks — E01-S63 · Unidades + histórico

> Marcar owner no ROADMAP. Branch: `feat/E01-S63-ferramentas-unidades-historico`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E01-S63_ferramenta_unidades.sql`: `pcm.ferramenta_unidades` (código sequencial via `sequence`/coluna `generated`, status `disponivel/atribuida/baixada`), `pcm.ferramenta_movimentacoes` (append-only — sem policy de UPDATE/DELETE, mesmo padrão `pcm.os_status_eventos` de `0020`), RLS FORCE padrão do repo; migração de dados: gerar unidades a partir de `quantidade_total` atual de cada ferramenta | AC-1 | — | `pnpm run lint:migrations` | todo |
| 2 | `domain/ferramenta-unidades.ts`: geração de código sequencial, transições de estado (disponível→atribuída→disponível/baixada), invariante "1 atribuição ativa por unidade" — puro, testes | AC-1–AC-3, AC-6 | 1 | `pnpm run test` | todo |
| 3 | Adapter/use cases: listar unidades por ferramenta, atribuir, devolver, baixar, histórico por unidade e por funcionário | AC-2–AC-6 | 2 | `pnpm run test` | todo |
| 4 | `fn_reconcile_ferramenta_alocacoes` (migration `0033`) passa a gravar em coluna/tabela "visão Auvo" separada (não mais fonte de verdade) — migration de ajuste + descriptor `ferramentas.ts` sem mudança de contrato Auvo | AC-7 | 1 | `pnpm run lint:migrations` | todo |
| 5 | UI: `FerramentasPage` ganha lista de unidades por ferramenta (código + status); `FerramentasPorTecnicoPage` reformulada para unidade-a-unidade + histórico + badge de divergência Auvo | AC-2–AC-7 | 3, 4 | `pnpm run test` | todo |
| 6 | pgTAP: append-only real (tentativa de UPDATE/DELETE falha), 1 atribuição ativa por unidade (constraint), RLS | AC-2, AC-4 | 1 | CI `db-tests` | todo |
| 7 | `pnpm run ci:local` + Playwright (cadastrar→atribuir→devolver→ver histórico) + ROADMAP/STATE | todos | 1–6 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: código sequencial nunca reaproveitado; atribuir unidade já atribuída falha; baixa é terminal.
- pgTAP: `ferramenta_movimentacoes` rejeita UPDATE/DELETE por policy/trigger.
- Playwright: ciclo completo com 1 ferramenta de 2 unidades.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (atribuir unidade baixada,
  devolver unidade não atribuída) · ROADMAP/STATE atualizados
