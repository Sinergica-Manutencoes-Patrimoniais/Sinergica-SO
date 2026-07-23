---
name: tasks
description: Decomposição e gates — dashboard de caixa (KPIs + gráficos SVG + RPCs).
alwaysApply: false
---

# Tasks — E04-S03 · Dashboard de caixa

> Depende de E04-S01 mergeada. Marcar owner no ROADMAP antes de codar.
> Branch: `feat/E04-S03-dashboard-caixa`. Ler a skill `dataviz` antes do primeiro gráfico.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E04-S03_rpcs_dashboard.sql`: `financeiro.fn_resumo_caixa()`, `fn_fluxo_mensal(meses int)`, `fn_gastos_categoria(inicio date, fim date)` — `security invoker`, `grant execute to authenticated` | AC-1–AC-4 | S01 | `pnpm run lint:migrations` | done |
| 2 | Componentes de gráfico SVG (`components/graficos/`): barras agrupadas, donut/barra de categorias, comparativo previsto×realizado — tema claro/escuro, estado vazio e erro | AC-2–AC-5 | — | `pnpm run test` | done |
| 3 | Use cases + adapter chamando as RPCs (tipos de retorno tipados; erro de rede vira estado de erro próprio, nunca "sem dados") | AC-1–AC-5 | 1 | `pnpm run test` | done |
| 4 | `FinanceiroDashboardPage`: KPIs + 3 blocos de gráfico + seletor de período; vira o item default do grupo FINANCEIRO na sidebar | todos | 2, 3 | `pnpm run test` | done |
| 5 | Teste de coerência: totais do dashboard × totais da lista de Lançamentos com o mesmo período (unit sobre a mesma RPC/fixture) | AC-1 | 3 | `pnpm run test` | done |
| 6 | `pnpm run ci:local` + Playwright (dashboard nos 2 temas, vazio e com dados) + ROADMAP/STATE | todos | 1–5 | `pnpm run ci:local` | done |

## Plano de teste
- Unit: componentes de gráfico (render com 0, 1, 12 pontos; valores negativos no resultado).
- pgTAP opcional: RPCs respeitam RLS (usuário sem módulo recebe vazio/erro, não dados).
- Playwright: dashboard carrega < sem erro de console, tema escuro legível.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [x] AC verdes pelo comando · `ci:local` verde · revisão adversarial (mês sem dado, categoria
  desativada com histórico, conta desativada) · ROADMAP/STATE atualizados
