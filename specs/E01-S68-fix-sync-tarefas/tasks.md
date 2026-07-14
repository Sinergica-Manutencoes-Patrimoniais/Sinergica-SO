---
name: tasks
description: Decomposição e gates — fix sync de tarefas (webhook URL, cursor→janela rolante, timezone).
alwaysApply: false
---

# Tasks — E01-S68 · Correção crítica do sync de tarefas

> Marcar owner no ROADMAP. Branch: `feat/E01-S68-fix-sync-tarefas`. **Prioridade máxima** —
> implementar antes das outras stories desta leva.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | `_shared/auvo/datetime.ts`: `auvoNaiveToUtc(s: string): string` — se a string não tem offset (`Z`/`±HH:MM`), assume `-03:00` (Brasília) e devolve ISO UTC; se já tem offset, passa direto; string vazia/nula → null. Testes Deno (naive, com Z, com offset, vazio) | AC-4 | — | `deno test` (CI) | todo |
| 2 | Aplicar `auvoNaiveToUtc` no import: `pcm-auvo-tasks-import/index.ts` ao montar `dataAgendada`/`checkInAt`/`checkOutAt` (linhas ~222-224) — antes de passar pra `montarLinhaOs`/RPC de enriquecimento | AC-4 | 1 | `deno test` | todo |
| 3 | Aplicar `auvoNaiveToUtc` no webhook: `pcm-auvo-webhook/index.ts` `firstIsoString` (~530-540) usa o helper em vez de `new Date().toISOString()`; cobrir replyDate/timeline do snapshot | AC-4 | 1 | `deno test` | todo |
| 4 | `pcm-auvo-tasks-import/index.ts`: remover cursor (`calcularInicioJanela`, `buscarCursorMaxDataAgendada`, `calcularInicioJanelaDeCursor` da E01-S67); `StartDate = now − 21d`, `EndDate = now + 60d`; manter override do corpo. Atualizar `index.test.ts` (remover 3 testes de cursor, adicionar teste de janela rolante) | AC-2 | — | `deno test` | todo |
| 5 | `pcm-auvo-webhooks-register/index.ts`: além de registrar, **deletar** webhooks cuja URL normalizada ≠ `targetUrl` atual (`DELETE /webHooks/{id}` — confirmar endpoint na API Auvo); idempotente | AC-1 | — | `deno test` | todo |
| 6 | Deploy + rodar `pcm-auvo-webhooks-register` uma vez (operacional); confirmar via `GET /webHooks` que todos apontam pra `nudann…` | AC-1 | 5 | manual (curl) | todo |
| 7 | Backfill: rodar `pcm-auvo-sync-all` com `{skipPulls:true, tasksImportRange:{...}}` em fatias de 30 dias sobre o histórico (script pontual, não agendado) — reescreve datas corrigidas | AC-5 | 2, 6 | manual | todo |
| 8 | Verificação em produção (read-only): OS de hoje aparecem em `pcm.ordens_servico`; `data_agendada` de tarefa 08:00 BRT = `11:00Z`; webhooks corretos. Atualizar ROADMAP/STATE | AC-3, AC-1, AC-4 | 1-7 | manual (query) | todo |

## Plano de teste
- Unit Deno: `auvoNaiveToUtc` (naive→+3h, com Z inalterado, com offset inalterado, vazio→null);
  janela rolante do tasks-import (StartDate/EndDate corretos, override respeitado).
- Manual/produção: comparar 1 tarefa Auvo (horário do app) com o `data_agendada` gravado.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes (Deno no CI — sem Deno CLI local)
- [ ] `pnpm run ci:local` verde (lado Node)
- [ ] Webhook re-registrado e confirmado em produção
- [ ] Backfill rodado; datas históricas corrigidas
- [ ] ROADMAP/STATE atualizados (nota: cursor da E01-S67 substituído)
