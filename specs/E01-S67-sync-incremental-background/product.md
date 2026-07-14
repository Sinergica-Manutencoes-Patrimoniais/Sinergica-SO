---
name: product
description: PRD — sync Auvo incremental por cursor de dado + execução em background com progresso visível. Origem direta do incidente E01-S62.
alwaysApply: false
---

# Product — Sync Auvo incremental + background (E01-S67)

> **Tier:** arquitetural (muda o mecanismo central do motor de sync já em produção com dado real)
> **Status:** aprovado pelo PO (Lucas, 2026-07-13), implementado na mesma sessão.

## Problema
O incidente E01-S62 (botão "Sincronizar Auvo" não trazia OS novas) tinha causa raiz numa decisão
de design: `pull:tickets` usa janela FIXA de 180 dias passado + 60 dias futuro, sempre paginando o
mesmo tanto de novo a cada execução — mesmo quando 99% desses registros já estão sincronizados e
só mudam via webhook. O fix aplicado (orçamento de tempo por etapa) trata o sintoma; a causa —
janela fixa que reprocessa dado já sincronizado — continua. `pcm-auvo-tasks-import` tem o mesmo
padrão (janela fixa de -14/+14 dias).

Separadamente, o botão de sync é uma chamada HTTP síncrona do browser: o usuário precisa ficar na
página esperando, sem barra de progresso, e sair da página pode interromper o processamento no
meio.

## Ideia do PO (Lucas, 2026-07-13)
1. Cron/pull consultam no banco a **última data de dado já sincronizado** e puxam só dali pra
   frente — o passado já sincronizado é mantido atualizado pelo webhook (tempo real), não precisa
   ser repaginado a cada rodada.
2. Tudo em lote (já é o padrão do repo — `auvoPaginate`/inserts em lote).
3. Sync roda em **background**: usuário vê progresso, pode sair da página, a sincronização
   continua no servidor e termina de qualquer forma.
4. Se o custo permitir, cron pode rodar de hora em hora em vez de diário, sem o usuário precisar
   clicar manualmente.

## Decisão de escopo desta story
- **Cursor incremental aplicado a `pcm-auvo-tasks-import`** (o exemplo citado pelo PO): usa
  `MAX(data_agendada)` das OS já sincronizadas do Auvo como início da janela, com 3 dias de
  sobreposição de segurança (tarefa retroagendada/atrasada no Auvo). Override manual
  (`startDate`/`endDate` no corpo) continua existindo para backfill pontual.
- **`pull:tickets` NÃO ganha cursor nesta story** — o schema local (`pcm.tickets`) não guarda a
  data de criação/abertura do ticket no Auvo, só metadado de sync (`auvo_synced_at`). Usar
  `auvo_synced_at` como `StartDate` do filtro do Auvo seria semanticamente errado (filtra por
  quando O AUVO acha que o ticket aconteceu, não por quando nós sincronizamos) — seria o mesmo
  tipo de erro de "inventar contrato sem verificar" que já causou bugs reais neste projeto (ex.:
  `taskID` vs `id`, E01-S34). Registrado como risco/próximo passo (§Riscos).
- **Background via `EdgeRuntime.waitUntil`** (já usado em `pcm-whatsapp-webhook`, mesmo padrão):
  `pcm-auvo-sync-all` responde imediato com um `runId`, continua processando no servidor
  independente da conexão do browser. Nova tabela `pcm.auvo_sync_runs` guarda status/resultado;
  a UI faz polling leve (select direto via RLS, sem Edge Function nova) e mostra progresso; se o
  usuário sair e voltar, a página busca a última execução e retoma o acompanhamento se ainda
  estiver rodando.
- **Cron de `tasks-import` sobe de diário (05:00 UTC) para horário** — seguro porque o cursor
  incremental faz o custo por execução cair (janela pequena, poucas páginas) em vez de sempre
  repaginar o intervalo fixo inteiro.

## Non-goals desta story
- Cursor incremental para `tickets`, `gps`, `expenses`/`satisfactions`/`questionnaires` — ficam
  como estão (tickets já roda hourly com janela fixa; os demais não têm o mesmo padrão de custo
  alto observado). Candidatos a story futura se o mesmo sintoma aparecer.
- Fila/job genérico reutilizável para outras operações longas do sistema — o padrão
  `auvo_sync_runs` é específico deste botão; generalizar é decisão separada quando houver 2º caso de uso.
- Notificação push quando o sync termina fora da página (V1: só polling enquanto a página está aberta).

## Riscos / premissas
- Premissa: `pcm.ordens_servico.data_agendada` reflete fielmente o `taskDate` do Auvo para tarefas
  já sincronizadas — confirmado desde E01-S38.
- Risco: se `pcm.ordens_servico` estiver vazia (ambiente novo) o cursor cai no fallback antigo
  (-14 dias) — sem regressão para o caso de bootstrap.
- Risco/próximo passo: `tickets` continua com o mesmo padrão de custo alto que causou o E01-S62;
  mitigado por manter o orçamento de tempo por etapa (fix do S62) até uma story dedicada resolver
  a causa raiz lá também (precisa antes confirmar com o Auvo qual data o filtro de `/tickets`
  realmente usa).
