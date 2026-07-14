---
name: design
description: Technical Design Doc — cursor incremental no tasks-import + execução em background do botão Sincronizar Auvo via EdgeRuntime.waitUntil + pcm.auvo_sync_runs.
alwaysApply: false
---

# Technical Design Doc — Sync incremental + background (E01-S67)

## Contexto
Ver `product.md` desta pasta. Duas mudanças independentes, mesma story por serem descobertas e
implementadas juntas na mesma sessão (2026-07-13), como continuação direta do incidente E01-S62.

## Mudança 1 — Cursor incremental em `pcm-auvo-tasks-import`

**Hoje:** `StartDate = agora - 14 dias` (fixo), `EndDate = agora + 14 dias` (fixo).

**Novo:**
```
cursor = MAX(data_agendada) de pcm.ordens_servico WHERE auvo_task_id IS NOT NULL
StartDate = cursor IS NOT NULL
  ? cursor - 3 dias   -- sobreposição de segurança (tarefa retroagendada/atrasada)
  : agora - 14 dias    -- fallback: nenhuma tarefa sincronizada ainda (bootstrap)
EndDate = agora + 14 dias  -- inalterado, forward window continua pequeno
```
Override de `startDate`/`endDate` no corpo da requisição continua tendo prioridade (backfill
pontual, comportamento já existente, inalterado).

Efeito: em operação normal (cron horário rodando), `cursor` fica sempre próximo de "agora", então
a janela em cada execução é de poucos dias — poucas páginas do Auvo por rodada, em vez de sempre
28 dias fixos. Idempotência já garantida pela checagem de `auvo_task_id` existente (nenhuma
mudança nessa parte).

**Por que 3 dias de overlap e não 0:** o cursor é `MAX(data_agendada)`, não "última execução do
cron". Se uma tarefa for criada no Auvo com data retroativa (ex.: técnico esqueceu de registrar e
lança 2 dias depois com a data real), o cursor já teria avançado além dela numa rodada anterior
sem overlap. 3 dias cobre esse caso sem reintroduzir o custo de uma janela grande.

**Por que não usar "última execução bem-sucedida" como cursor:** exigiria uma tabela de estado
adicional e ainda erraria se o cron ficar paralisado por dias (cursor baseado em dado real do
próprio domínio é mais robusto que timestamp de execução).

## Mudança 2 — Execução em background do botão "Sincronizar Auvo"

**Hoje:** browser chama `pcm-auvo-sync-all` e espera a resposta HTTP completa (até ~150s+); sair
da página aborta a conexão e, na prática, mata o processamento no meio (Edge Function usa o
lifecycle da requisição).

**Novo:**
```
POST pcm-auvo-sync-all
  → cria linha em pcm.auvo_sync_runs (status='running', started_at=now())
  → responde 202 { runId, status: 'running' } IMEDIATAMENTE
  → EdgeRuntime.waitUntil(
       runSyncAll(...).then(resultado => UPDATE auvo_sync_runs SET status=ok?'succeeded':'failed',
                                                  results=resultado.results, finished_at=now())
     )
```
Mesmo padrão já usado em `pcm-whatsapp-webhook` (`EdgeRuntime.waitUntil`, com fallback
`run()` direto se `EdgeRuntime` não existir — mesmo guard defensivo, runtime local/testes).

**Tabela `pcm.auvo_sync_runs`:**
```sql
pcm.auvo_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  ok boolean,                    -- null enquanto running
  results jsonb,                 -- StepResult[] quando terminado
  requested_by uuid references auth.users,
  started_at timestamptz not null default now(),
  finished_at timestamptz
)
```
RLS: `select` para `pcm` leitura/escrita (mesmo padrão de `auvo_entity_status`); `insert`/`update`
só `service_role` (a Edge Function usa a service key, nunca o browser grava direto).

**Polling da UI:** sem Edge Function nova — o browser lê `pcm.auvo_sync_runs` direto via
`supabase.from(...)` sob RLS (já autenticado, já tem `pcm:leitura`). Intervalo de 3s enquanto
`status='running'`; para no primeiro terminal. Ao montar a página, busca a run mais recente
(`order by started_at desc limit 1`); se `status='running'` e `started_at` há menos de 10 min,
retoma o polling e mostra a barra de progresso em vez do botão ocioso — cobre o caso "usuário saiu
e voltou". Sync iniciado por outra aba/sessão também aparece (a run é global, não por usuário).

**Por que não Realtime (Supabase Realtime/websocket):** polling de 3s numa tabela de 1 linha ativa
por vez é simples, sem infra nova, e o botão não é usado com frequência alta o bastante pra
justificar websocket. Se o padrão precisar generalizar para outras operações longas, reavaliar.

## Mudança 3 — Cron de `tasks-import`: diário → horário

Migration ajusta `cron.schedule('pcm_auvo_tasks_import_diario', ...)` de `'0 5 * * *'` para
`'0 * * * *'` — seguro porque a Mudança 1 torna o custo por execução baixo (janela pequena) em vez
do padrão fixo de 28 dias que motivou originalmente rodar só 1x/dia (ver comentário original em
`0038_E01-S34_cron_tasks_import.sql`, "não competir por rate limit no mesmo minuto do cron de
catálogo 06:00" — script mantém esse cuidado: roda no minuto `0` de cada hora, cron de catálogo
(0037) continua só às 06:00, cruzam 1x/dia no pior caso, não a cada hora).

## Cobertura dos 5 eixos
1. **Tech stack:** nenhuma dependência nova — `EdgeRuntime.waitUntil` é global do runtime Deno
   Deploy (já usado no repo), polling é `supabase-js` puro.
2. **Arquitetura:** extensão do motor de sync existente (E01-S22/S23), não bounded context novo.
3. **Infra:** 1 tabela nova, 1 alteração de cron schedule — sem secret novo, sem Edge Function nova.
4. **Qualidade:** testes Deno para a função de cálculo do cursor (pura) e para o novo fluxo
   respond-then-continue de `sync-all` (via stub, sem depender de `EdgeRuntime` real);
   `auvo_sync_runs` coberta por pgTAP (RLS + só service_role escreve).
5. **Observabilidade:** `auvo_sync_runs.results` é o mesmo `StepResult[]` já logado hoje — não
   perde nenhuma informação que já existia, só passa a ficar consultável sem esperar a resposta HTTP.

## Alternativas consideradas
- **Cursor por `auvo_synced_at` (data da nossa sincronização) em vez de `data_agendada` (data do
  dado em si):** rejeitada — não é o que o filtro `StartDate`/`EndDate` do Auvo espera (filtra
  pela data da TAREFA, não de quando sincronizamos); usar o campo errado reintroduziria o mesmo
  tipo de bug de contrato não verificado já visto neste projeto.
- **Fila real (pg-boss, Postgres LISTEN/NOTIFY) para o job em background:** descartada por
  complexidade desproporcional a 1 botão que não é chamado com frequência.
- **Estender `tickets` com o mesmo cursor nesta story:** adiada — falta confirmar com o Auvo qual
  data `/tickets` realmente filtra antes de usar `data_agendada`-like local (ver `product.md` §Riscos).

## Riscos
- Ver `product.md` §Riscos — cursor com fallback seguro para bootstrap; `tickets` mantém o
  orçamento de tempo (fix do S62) até story dedicada.
- Rodar `tasks-import` de hora em hora aumenta a frequência de chamadas ao Auvo (24x/dia em vez de
  1x/dia) mas cada uma é barata (janela pequena) — soma de custo esperada é MENOR que antes, não
  maior (28 dias fixos 1x/dia > poucos dias 24x/dia, na maior parte dos dias sem muita tarefa
  nova). Se o rate limit (400 req/min, ADR/design E01-S22) apertar, o primeiro ajuste é reduzir a
  cadência antes de reintroduzir janela grande.
