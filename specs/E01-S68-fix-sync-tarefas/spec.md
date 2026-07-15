---
name: spec
description: Contrato — corrige o sync de tarefas Auvo→PCM (webhook apontando pro projeto errado, cursor que exclui hoje, timezone -3h). Bug crítico achado em produção 2026-07-14.
alwaysApply: true
---

# Spec — E01-S68 · Correção crítica do sync de tarefas Auvo→PCM

> **Fonte da verdade.** Status: pronto para implementar · Tier: médio · **Prioridade máxima**
> (nada mais no PCM é confiável enquanto o dado de OS estiver errado/faltando). Origem: teste de
> produção do Lucas (2026-07-14) — "não apareceram as OS de hoje" + suspeita de timezone.
> Auto-contida: contexto e evidência abaixo; padrões do repo em `CLAUDE.md`.

## Problema (3 causas independentes, confirmadas em produção)

**Causa A — Webhooks do Auvo apontam para o projeto Supabase ERRADO.** Os 6 webhooks registrados
no Auvo (Customer/Task/entity-27, Inclusão+Alteração) apontam para
`https://sfprfvltbtysvtsqutla.supabase.co/functions/v1/pcm-auvo-webhook` — um projeto **antigo**.
A produção atual é `https://nudannsrfvjggoergvyn.supabase.co`. O reprovisionamento do Supabase
(registrado no STATE) nunca re-registrou os webhooks. **Resultado: o caminho de tempo real está
morto** — toda tarefa nova/alterada no Auvo nunca chega ao PCM por webhook.

**Causa B — Cursor incremental (E01-S67) exclui o presente.** `pcm-auvo-tasks-import` usa
`StartDate = MAX(data_agendada) − 3 dias`. Como há preventivas **agendadas para o futuro** (ex.:
CH-2364 agendada para 2026-07-22), o cursor pula para 22/07 e a janela vira 19/07–28/07, excluindo
as tarefas de hoje (13/07). Confirmado: a última run puxou só **1 tarefa**. O filtro do Auvo
`/tasks` é sobre `taskDate` (data agendada), não sobre data de criação/modificação — então um
cursor baseado em data agendada é **intrinsecamente quebrado** quando existem tarefas futuras.
Regressão introduzida na E01-S67.

**Causa C — Timezone: datas do Auvo (Brasília) gravadas como UTC.** O Auvo devolve datetime naive
sem offset (`"2026-07-13T08:00:00"` = 08:00 horário de Brasília). Dois caminhos gravam errado:
- **Import** (`pcm-auvo-tasks-import/index.ts:222-224` → `os-from-task.ts:180-182`): grava a string
  verbatim numa coluna `timestamptz`; o Postgres interpreta no fuso da sessão (UTC) → `08:00Z`.
- **Webhook** (`pcm-auvo-webhook/index.ts:530-540`, `firstIsoString` = `new Date(naive).toISOString()`
  com `TZ=UTC` no runtime das Edge Functions) → mesmo `08:00Z`.
Real correto seria `11:00Z` (08:00 BRT = 11:00 UTC). **Resultado: `data_agendada`, `check_in_at`,
`check_out_at` e a timeline/checkin do snapshot ficam 3h adiantados.**

## Resumo
(A) `pcm-auvo-webhooks-register` passa a **deletar webhooks com URL divergente** da atual e
re-registrar na URL certa; roda uma vez pós-deploy. (B) `pcm-auvo-tasks-import` abandona o cursor e
volta a uma **janela rolante** (`now − 21d` a `now + 60d`) que cobre preventivas próximas sem
excluir o presente. (C) helper puro `auvoNaiveToUtc` trata datetime naive do Auvo como `-03:00` nos
dois caminhos + snapshot; backfill re-escreve o histórico corrigido.

## Critérios de aceite

### AC-1: Webhook re-registrado na URL correta
- **Dado** webhooks Auvo apontando para uma URL de projeto Supabase diferente da atual
- **Quando** `pcm-auvo-webhooks-register` roda
- **Então** os webhooks com URL divergente são deletados (`DELETE /webHooks/{id}`) e recriados
  apontando para `${SUPABASE_URL}/functions/v1/pcm-auvo-webhook`; rodar de novo é idempotente (não
  duplica)

### AC-2: Janela rolante cobre o presente
- **Dado** `pcm-auvo-tasks-import` sem override no corpo
- **Quando** roda (mesmo havendo tarefas agendadas para o futuro)
- **Então** `StartDate = now − 21 dias` e `EndDate = now + 60 dias` (não depende de
  `MAX(data_agendada)`); as funções de cursor da E01-S67 (`calcularInicioJanela`,
  `buscarCursorMaxDataAgendada`, `calcularInicioJanelaDeCursor`) são removidas; override manual
  `startDate`/`endDate` continua funcionando para backfill

### AC-3: Tarefas de hoje viram OS
- **Dado** tarefas criadas no Auvo para a data de hoje
- **Quando** o sync roda (webhook ou `tasks-import`)
- **Então** elas aparecem em `pcm.ordens_servico` (verificável por query em produção)

### AC-4: Timezone correto (Brasília → UTC)
- **Dado** uma tarefa Auvo com `taskDate = "2026-07-13T08:00:00"` (naive, Brasília)
- **Quando** gravada no PCM pelo import OU pelo webhook
- **Então** `data_agendada` = `2026-07-13T11:00:00Z` (08:00 BRT + 3h). O mesmo vale para
  `check_in_at`/`check_out_at` e para `replyDate`/timeline do snapshot. Função pura
  `auvoNaiveToUtc(s)` (em `_shared/auvo/datetime.ts`) trata string sem offset como `-03:00`
  (Brasília não tem horário de verão desde 2019 — offset fixo). Datas já com offset ou de "agora"
  (`new Date().toISOString()`) não são alteradas.

### AC-5: Backfill do histórico
- **Dado** OS históricas com datas gravadas 3h adiantadas (pré-fix)
- **Quando** o backfill de re-sync roda (`pcm-auvo-sync-all` com `tasksImportRange` em fatias, mesmo
  padrão do backfill de 2026-07-09)
- **Então** `data_agendada`/`check_in_at`/`check_out_at` são reescritas corrigidas (upsert por
  `auvo_task_id` via enriquecimento). Task operacional documentada.

## Fora de escopo
> Vinculante.
- Exibir os detalhes ricos do Auvo (questionários/fotos) — E01-S70.
- Filtro por data de modificação no Auvo (otimização de custo futura) — só usar se confirmado que a
  API suporta; nesta story a janela rolante + webhook resolvem.
- Migration de shift de dados (+3h) direto no banco — arriscado; o backfill via re-sync é o caminho
  seguro (reescreve com o valor certo da fonte).

## Rastreabilidade
- Origem: teste de produção Lucas 2026-07-14; diagnóstico read-only (webhooks, cursor, timezone).
- Arquivos-âncora: `supabase/functions/pcm-auvo-webhooks-register/index.ts`,
  `supabase/functions/pcm-auvo-tasks-import/index.ts` (+ `index.test.ts`),
  `supabase/functions/_shared/auvo/os-from-task.ts`, `supabase/functions/pcm-auvo-webhook/index.ts`
  (`firstIsoString`), novo `supabase/functions/_shared/auvo/datetime.ts`.
- Precedente: backfill em fatias via `pcm-auvo-sync-all` `{skipPulls, tasksImportRange}` (STATE
  2026-07-09); orçamento por etapa (E01-S62).
