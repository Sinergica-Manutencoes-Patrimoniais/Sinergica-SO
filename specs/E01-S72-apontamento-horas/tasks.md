---
name: tasks
description: Decomposição e gates — apontamento de horas por OS/cliente/técnico + custo.
alwaysApply: false
---

# Tasks — E01-S72 · Apontamento de horas

> Marcar owner no ROADMAP. Branch: `feat/E01-S72-apontamento-horas`. **Depende de E01-S68** (sem o
> fix de timezone, as horas por dia saem erradas).

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E01-S72_apontamento_horas.sql`: view/RPC `pcm.fn_apontamento_horas(inicio date, fim date)` `security invoker` — por OS: horas (`durationDecimal` ou `check_out_at−check_in_at`), técnico, cliente; grant execute authenticated | AC-1 | E01-S68 | `pnpm run lint:migrations` | todo |
| 2 | `domain/apontamento-horas.ts`: cálculo puro de horas (prioridade durationDecimal; fallback diff de datas; sem dado → 0), agregação por cliente/técnico — testes unit | AC-1, AC-2 | — | `pnpm run test` | todo |
| 3 | application/gateway + adapter chamando a RPC; casos de uso listar por OS, agregar por cliente/técnico | AC-1, AC-2 | 1, 2 | `pnpm run test` | todo |
| 4 | `ApontamentoHorasPage.tsx`: lista por OS + filtros (período/técnico/cliente) + totais agregados; item na sidebar PCM (grupo OPERAÇÃO ou RELATÓRIOS) | AC-3 | 3 | `pnpm run test` | todo |
| 5 | Ponte de custo: se `financeiro.custos_funcionario` existir, custo = horas × R$/h; senão só horas + nota. Detectar presença sem quebrar (try/catch ou feature-check) | AC-4 | 3 | `pnpm run test` | todo |
| 6 | `pnpm run ci:local` + Playwright (ver horas por OS, agregar por cliente) + ROADMAP/STATE | todos | 1-5 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: cálculo de horas (durationDecimal, diff de datas, sem dado); agregação.
- Playwright: filtros e totais.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes · `ci:local` verde · revisão adversarial (OS sem check-out; técnico não atribuído) ·
  ROADMAP/STATE atualizados · nota de dependência E01-S68/E04-S06
