---
name: tasks
description: Decomposição e gates — preventivo recorrente PCM→Auvo (bloqueada em design.md + credencial API).
alwaysApply: false
---

# Tasks — Preventivo recorrente: PCM comanda, Auvo executa

> ⚠️ Tier arquitetural: tasks 1-2 vêm ANTES de qualquer código de feature.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Teste de contrato com credencial API real: criar/inspecionar/excluir 1 service order de teste E 1 task recorrente de teste; registrar payloads reais | — | credencial Auvo | manual (curl, registro no design) | todo |
| 2 | `design.md` (@architect): mecanismo A×B, modelo `pcm.planos_preventivos`, idempotência, ADR "PCM dono do preventivo" | — | 1 | revisão | todo |
| 3 | Migration `pcm.planos_preventivos` (+`plano_preventivo_id` em `pcm.ordens_servico`, `NOT VALID`→`VALIDATE`) | AC-1, AC-3 | 2 | `pnpm run lint:migrations` | todo |
| 4 | Domain/application/adapter + UI de planos (lista por cliente, form, ativar/pausar) | AC-1, AC-5 | 3 | `pnpm run test` | todo |
| 5 | Write path: ativação cria recorrência no Auvo (Edge Function ou outbox, conforme design) com idempotência | AC-2, AC-5 | 2, 3 | `deno test` | todo |
| 6 | Vincular ocorrências: `os-from-task`/webhook reconhecem tarefa de plano e gravam `plano_preventivo_id` | AC-3 | 5 | `deno test` | todo |
| 7 | Aderência: % cumprido + atrasadas no cliente-360 e calendário | AC-4 | 6 | `pnpm run test` | todo |
| 8 | pgTAP RLS + `pnpm run ci:local` + ROADMAP/STATE + validação manual com plano piloto real (1 cliente) | todos | 1-7 | `pnpm run ci:local` | todo |

## Plano de teste
- Contrato: payload real registrado antes do schema (task 1).
- Unit: geração de idempotência, regras de status do plano, cálculo de aderência.
- E2E manual: plano piloto num cliente real, acompanhar 1 ciclo de geração.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ADR registrado · ROADMAP/STATE atualizados
