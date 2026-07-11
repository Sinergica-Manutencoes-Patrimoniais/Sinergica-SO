---
name: tasks
description: Decomposição e gates — despesas Auvo → custo real por OS/cliente.
alwaysApply: false
---

# Tasks — Custo real da OS: despesas do Auvo no PCM

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Verificar contrato real de `/expenses` e `/expensetypes` com credencial (campos, vínculo com task, filtros) | todos | credencial Auvo | manual (curl) | todo |
| 2 | Migrations `pcm.despesa_tipos` + `pcm.despesas` (RLS FORCE, unique `auvo_id`, FK opcional p/ OS `NOT VALID`→`VALIDATE`) | AC-1 | 1 | `pnpm run lint:migrations` | todo |
| 3 | Descriptors `despesa_tipos`/`despesas` no registry (`writeEnabled:false`, cron; resolver OS por task id) + testes Deno | AC-1, AC-4 | 2 | `deno test` | todo |
| 4 | Painel da OS: bloco de despesas + soma | AC-2 | 3 | `pnpm run test` | todo |
| 5 | Cliente-360 aba Financeiro: despesas/mês (12m) | AC-3 | 3 | `pnpm run test` | todo |
| 6 | pgTAP RLS + `pnpm run ci:local` + ROADMAP/STATE + validação manual com dado real | todos | 1-5 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: `fromAuvo` dos 2 descriptors (tipos de campo confirmados na task 1), agregação por mês.
- Manual: comparar totais com o relatório Despesas do Auvo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
