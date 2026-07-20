---
name: tasks-E01-S03-pmoc-schema
description: Tasks (retroativas) da fundação PMOC + log de SPEC_DEVIATION + pendências herdadas.
alwaysApply: false
---

# Tasks — E01-S03: Sub-módulo PMOC (retroativo)

> Reconciliação do gap de processo: S03b (PR #28) entrou sem `spec.md`/`tasks.md`. Aqui o plano
> retroativo do que foi entregue, o desvio do `design.md` e as pendências que viram E01-S04/S05/S06/S07.

## Plano (estado real)
| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Migration `0023` — 7 tabelas `pmoc_*` + RLS FORCE + GRANT + FK circular schedules↔records | AC-1, AC-8 | `pnpm run lint:migrations` | ✅ |
| 2 | domain `pmoc.ts` — `gerarCronogramaPmoc`, `tipoManutencaoPorMes`, `CHECKLIST_PMOC` + `.test.ts` | AC-3, AC-7 | `pnpm test` | ✅ |
| 3 | application `pmoc-gateway.ts` (porta) + `pmoc.ts` (use-cases) + `.test.ts` | AC-2, AC-4, AC-5, AC-6 | `pnpm test` | ✅ |
| 4 | infra `supabase-pmoc-adapter.ts` — CRUD contrato/equipamento, insert do cronograma, leitura consolidada, métricas | AC-2..AC-6 | `pnpm typecheck` | ✅ |
| 5 | UI `PmocPage.tsx` — contratos, detalhe, cadastro de equipamento, sugestões Auvo, widgets de gestão | AC-4, AC-5, AC-6 | `pnpm build` | ✅ |
| 6 | Reconciliação retroativa: `spec.md` + `tasks.md` + ROADMAP | — | `pnpm run audit:esteira` / `eval:spec` | ✅ (esta task) |

## Plano de teste
- **Unidade (Vitest):** `gerarCronogramaPmoc` (12 visitas, tipo por mês, datas), `tipoManutencaoPorMes`,
  seleção de checklist por tipo (`domain/pmoc.test.ts`); use-cases (`application/pmoc.test.ts`).
- **RLS (pgTAP):** **pendente** — não há suíte pgTAP das tabelas `pmoc_*` (gap herdado; abrir em E01-S06
  junto com a gestão de microbio/NC, ou como task de hardening). Sinalizado.
- **Aceite (Playwright):** **pendente** — sem e2e do fluxo de contrato/cronograma (gap herdado).

## Divergências (SPEC_DEVIATION)
- **SD-1 — Cronograma client-side em vez de Edge Function `pmoc-generate-schedule` (design Decisão 3).**
  Implementado como função pura de domínio (`gerarCronogramaPmoc`) + insert no adapter dentro de
  `criarContrato`. Justificativa: cálculo de datas puro, sem I/O; transacional com o insert do contrato;
  evita infra de Edge Function para lógica determinística. Não corrige o design (decisão consciente de
  manter client-side); registrado aqui como a fonte da verdade do desvio.

## Pendências herdadas (viram outras stories — não são regressão de S03)
- **E01-S04:** `pcm.pcm_equipment` (espelho cross-disciplina, design Decisão 2) + trigger/espelhamento + wizard de inventário.
- **E01-S05:** webhook Auvo→`pmoc_records`, geração de **PDF** do laudo (Storage) + e-mail ao contato do imóvel.
- **E01-S06:** gestão (create/update) de `pmoc_microbio_analysis` e `pmoc_nonconformity_log` + regras de alerta
  (NC alta imediata; microbiológico não-conforme `fungi>750`/`ie>1.5`/`coliforms=presenca`).
- **Transversal (cron):** `pmoc-auvo-create-os` (D-7), `pmoc-daily-status` (atrasado), `pmoc-alert-art` (D-30),
  `pmoc-alert-microbio` — nenhuma Edge Function PMOC está deployada hoje.
- **E01-S07:** Hub de OS (decisão adiada, design Decisão 5).
- **Hardening:** suíte pgTAP das tabelas `pmoc_*` e e2e do fluxo de contrato.

## Definition of Done (retroativo)
- [x] AC-1..AC-8 cobertos pela implementação existente (schema + domínio + application + infra + UI).
- [x] SPEC_DEVIATION SD-1 registrada.
- [x] `spec.md`/`tasks.md` criados; ROADMAP atualizado (gap de processo fechado).
- [ ] pgTAP `pmoc_*` + e2e — pendências herdadas, rastreadas acima (não bloqueiam a reconciliação).
