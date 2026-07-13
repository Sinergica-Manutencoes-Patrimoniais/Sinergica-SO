---
name: tasks
description: Decomposição e gates — custo/hora por funcionário, custo real por OS e rentabilidade por cliente.
alwaysApply: false
---

# Tasks — E04-S06 · Rentabilidade por cliente

> Depende de E04-S01 e E04-S04 mergeadas. Marcar owner no ROADMAP antes de codar.
> Branch: `feat/E04-S06-rentabilidade-cliente`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Verificar chaves reais** de `pcm.ordens_servico.auvo_detalhes` (duração/check-in/out) e o vínculo OS→funcionário por query read-only em produção/CI — registrar o shape encontrado nesta pasta antes da view | AC-2 | acesso leitura | manual (SQL read-only) | todo |
| 2 | Migration `NNNN_E04-S06_custos_rentabilidade.sql`: `financeiro.custos_funcionario` (RLS FORCE padrão, unique `funcionario_id, vigente_desde`), view/RPC de custo por OS e view `rentabilidade_cliente_mes` (`security_invoker=on`) usando as chaves confirmadas na task 1 | AC-1–AC-3 | 1 | `pnpm run lint:migrations` | todo |
| 3 | `domain/rentabilidade.ts`: R$/h por vigência, valoração de horas (funcionário sem custo → "não valorado"), margem %, regra dos 2 meses consecutivos fechados — puro, com testes | AC-1, AC-4, AC-6 | — | `pnpm run test` | todo |
| 4 | Use cases + adapter: CRUD custos de funcionário (lista de `pcm.funcionarios`), rentabilidade 12m, drill-down por OS, cobertura de valoração | AC-1–AC-6 | 2, 3 | `pnpm run test` | todo |
| 5 | `CustosPessoalPage` (funcionários + custo vigente + histórico + R$/h) | AC-1 | 4 | `pnpm run test` | todo |
| 6 | `RentabilidadePage` (ranking 12m, margem R$/%, alerta 2 meses, drill-down, indicador de cobertura, aviso honesto de despesas sem sync) | AC-3–AC-6 | 4 | `pnpm run test` | todo |
| 7 | pgTAP: RLS de `custos_funcionario`; view respeita RLS; vigência correta na virada de mês | AC-1, AC-2 | 2 | CI `db-tests` | todo |
| 8 | `pnpm run ci:local` + Playwright (cadastrar custo→ver margem→drill-down) + validação com dado real (comparar 1 cliente contra conta manual do Lucas/Fabrício) + ROADMAP/STATE | todos | 1–7 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: vigência (data exata da virada), horas não valoradas, 2-meses (negativo/positivo/negativo
  não dispara; corrente incompleto não dispara), divisão por horas-base 0 → erro de domínio.
- Manual: 1 cliente real conferido contra cálculo manual do PO.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (OS de cliente sem contrato,
  funcionário desligado com histórico, mês sem receita mas com custo) · ROADMAP/STATE atualizados
