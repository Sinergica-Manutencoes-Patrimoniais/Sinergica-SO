---
name: tasks
description: Decomposição e gates — contratos, recebíveis recorrentes, aging e inadimplência.
alwaysApply: false
---

# Tasks — E04-S04 · Contratos + contas a receber

> Depende de E04-S01 mergeada. Marcar owner no ROADMAP antes de codar.
> Branch: `feat/E04-S04-contratos-contas-receber`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E04-S04_contratos_recebiveis.sql`: `financeiro.contratos` (RLS FORCE padrão), FK `lancamentos.contrato_id` (`NOT VALID`→`VALIDATE`), unique parcial `(contrato_id, data_competencia) where origem='recorrencia'`, RPC `fn_gerar_recorrencias(competencia)` (`security definer` avaliado × `invoker` — justificar na migration), view `aging_recebiveis` (`security_invoker=on`) | AC-2, AC-4 | S01 | `pnpm run lint:migrations` | done |
| 2 | Migration/patch pg_cron dia 1 chamando `fn_gerar_recorrencias(now())` — padrão `0011`/`0013` | AC-2 | 1 | `pnpm run lint:migrations` | done |
| 3 | `domain/recorrencia.ts`: competência-alvo, contrato vigente (início/fim/status), cálculo de vencimento — puro, com testes (borda: contrato começa/termina no meio do mês) | AC-2 | — | `pnpm run test` | done |
| 4 | Use cases + adapter: CRUD contratos, gerar previstos do mês (RPC), listar recebíveis com aging, baixa/estorno, agrupamento por cliente | AC-1–AC-5 | 1, 3 | `pnpm run test` | done |
| 5 | `ContratosPage` (lista + form + soma de receita mensal prevista + aviso de bloqueio AC-6) | AC-1, AC-6 | 4 | `pnpm run test` | done |
| 6 | `ContasReceberPage` (faixas de aging, badges D+3/7/15, baixa por linha, visão por cliente) | AC-3–AC-5 | 4 | `pnpm run test` | done |
| 7 | KPI de inadimplência no dashboard (se S03 já mergeada; senão registrar pendência na S03) | AC-5 | 4 | `pnpm run test` | done |
| 8 | pgTAP: RLS de `contratos`, unique parcial (2ª geração não duplica), view de aging | AC-2, AC-4 | 1 | CI `db-tests` | done |
| 9 | `pnpm run ci:local` + Playwright (criar contrato→gerar mês→ver aging→baixar) + ROADMAP/STATE | todos | 1–8 | `pnpm run ci:local` | done |

## Plano de teste
- Unit: vigência de contrato nas bordas, competência com dia 29–31 (dia_vencimento máx. 28 evita), idempotência lógica.
- pgTAP: rodar `fn_gerar_recorrencias` 2× e contar linhas.
- Playwright: ciclo contrato→recebível→baixa.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [x] AC verdes pelo comando · `ci:local` verde · revisão adversarial (contrato encerrado no meio
  do mês, dois contratos do mesmo cliente, competência retroativa) · ROADMAP/STATE atualizados
- [x] Se o formato de contrato divergir do design D-5 → ADR novo (futuro E03 Comercial)
