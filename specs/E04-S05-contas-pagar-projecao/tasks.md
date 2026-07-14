---
name: tasks
description: Decomposição e gates — contas a pagar, recorrências de saída e projeção de caixa.
alwaysApply: false
---

# Tasks — E04-S05 · Contas a pagar + projeção

> Depende de E04-S01 e E04-S03 mergeadas (S04 recomendada antes — compartilha a RPC de
> recorrência; se S04 ainda não existir, esta story cria a RPC e a S04 estende).
> Marcar owner no ROADMAP. Branch: `feat/E04-S05-contas-pagar-projecao`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E04-S05_recorrencias_projecao.sql`: `financeiro.recorrencias` (RLS FORCE padrão), coluna+FK `lancamentos.recorrencia_id`, unique parcial, extensão de `fn_gerar_recorrencias` p/ saídas, RPC `fn_projecao_caixa(horizonte_dias int)` | AC-1, AC-3 | S01 | `pnpm run lint:migrations` | todo |
| 2 | Domínio: geração de saída recorrente (reusa `recorrencia.ts` da S04; borda: recorrência desativada no meio do mês) — testes | AC-1 | 1 | `pnpm run test` | todo |
| 3 | Use cases + adapter: CRUD recorrências, listar a pagar (faixas), baixa, projeção | AC-1–AC-3 | 1 | `pnpm run test` | todo |
| 4 | `ContasPagarPage` (faixas por vencimento, baixa, filtros) + form de recorrências | AC-1, AC-2 | 3 | `pnpm run test` | todo |
| 5 | Bloco projeção 30/60/90 no `FinanceiroDashboardPage` (destaque de saldo negativo, expansão semanal) | AC-3, AC-4 | 3 | `pnpm run test` | todo |
| 6 | pgTAP: RLS de `recorrencias`, idempotência da geração de saída, `fn_projecao_caixa` não conta baixado duas vezes | AC-1, AC-4 | 1 | CI `db-tests` | todo |
| 7 | `pnpm run ci:local` + Playwright (recorrência→gerar→pagar→projeção atualiza) + ROADMAP/STATE | todos | 1–6 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: janela 30/60/90 (previsto no dia-limite entra?), baixa remove do projetado.
- pgTAP: geração 2× não duplica; projeção com caixa vazio.
- Playwright: ciclo completo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (previsto sem vencimento,
  recorrência com conta desativada) · ROADMAP/STATE atualizados
