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
| 1 | `_shared/auvo/datetime.ts`: `auvoNaiveToUtc(s: string): string` — se a string não tem offset (`Z`/`±HH:MM`), assume `-03:00` (Brasília) e devolve ISO UTC; se já tem offset, passa direto; string vazia/nula → null. Testes Deno (naive, com Z, com offset, vazio) | AC-4 | — | `deno test` (CI) | **done** (código+testes escritos; Deno CLI ausente local, roda no CI) |
| 2 | Aplicar `auvoNaiveToUtc` no import: `pcm-auvo-tasks-import/index.ts` ao montar `dataAgendada`/`checkInAt`/`checkOutAt` — antes de passar pra `montarLinhaOs`/RPC de enriquecimento | AC-4 | 1 | `deno test` | **done** |
| 3 | Aplicar `auvoNaiveToUtc` no webhook: `pcm-auvo-webhook/index.ts` `firstIsoString` usa o helper pro ramo string (número/epoch não muda — já é instante absoluto); cobre também replyDate/timeline do snapshot (mesma função) | AC-4 | 1 | `deno test` | **done** |
| 4 | `pcm-auvo-tasks-import/index.ts`: removidas `calcularInicioJanela`/`buscarCursorMaxDataAgendada`/`calcularInicioJanelaDeCursor` (E01-S67); nova `calcularJanelaRolante` pura, `StartDate = now − 21d`, `EndDate = now + 60d`; override do corpo preservado. `index.test.ts` atualizado (3 testes de cursor trocados por 2 de janela rolante, incluindo o cenário exato do incidente) | AC-2 | — | `deno test` | **done** |
| 5 | `pcm-auvo-webhooks-register/index.ts`: reescrito — deleta webhooks com URL divergente (`DELETE /webHooks/{id}`, campo real `urlResponse` corrigido) e registra os que faltam, incluindo **Task** (entity=4, hardcoded — não tem descriptor no registry genérico, valor documentado em `registry/types.ts`). Achado extra: o contrato real de `GET /webHooks` não batia com o código (campo `urlResponse` não `targetUrl`, `entity` como string tipo `"Customer"` não número) — corrigido. Funções puras extraídas (`encontrarWebhooksStale`, `descriptorsParaRegistrar`) + `index.test.ts` novo, 9 casos | AC-1 | — | `deno test` | **done** |
| 6 | Deploy + rodar `pcm-auvo-webhooks-register` uma vez (operacional); confirmar via `GET /webHooks` que todos apontam pra `nudann…` | AC-1 | 5 | manual (curl) | todo — depende de deploy |
| 7 | Backfill: rodar `pcm-auvo-sync-all` com `{skipPulls:true, tasksImportRange:{...}}` em fatias de 30 dias sobre o histórico (script pontual, não agendado) — reescreve datas corrigidas | AC-5 | 2, 6 | manual | todo — depende de deploy |
| 8 | Verificação em produção (read-only): OS de hoje aparecem em `pcm.ordens_servico`; `data_agendada` de tarefa 08:00 BRT = `11:00Z`; webhooks corretos. Atualizar ROADMAP/STATE | AC-3, AC-1, AC-4 | 1-7 | manual (query) | todo — depende de deploy |

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
