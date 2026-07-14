---
name: spec
description: Contrato — cursor incremental no tasks-import (janela por última data sincronizada) + botão Sincronizar Auvo roda em background com progresso.
alwaysApply: true
---

# Spec — E01-S67 · Sync incremental + background

> **Fonte da verdade.** Status: implementado nesta sessão · Tier: arquitetural
> Ver `product.md`/`design.md` desta pasta. Origem: ideia do PO (Lucas, 2026-07-13), continuação
> direta do incidente E01-S62.

## Critérios de aceite

### AC-1: Cursor incremental no tasks-import
- **Dado** `pcm.ordens_servico` com tarefas já sincronizadas do Auvo
- **Quando** `pcm-auvo-tasks-import` roda sem override no corpo
- **Então** `StartDate` = `MAX(data_agendada)` das OS com `auvo_task_id` preenchido, menos 3 dias
  de sobreposição; `EndDate` continua `agora + 14 dias`

### AC-2: Fallback de bootstrap
- **Dado** `pcm.ordens_servico` sem nenhuma OS vinda do Auvo (ambiente novo)
- **Quando** `pcm-auvo-tasks-import` roda
- **Então** usa a janela fixa antiga (`agora - 14 dias` a `agora + 14 dias`) — sem regressão no
  cenário de bootstrap

### AC-3: Override manual preservado
- **Dado** um corpo de requisição com `startDate`/`endDate` explícitos (backfill pontual)
- **Quando** a função roda
- **Então** ignora o cursor calculado e usa exatamente o que foi passado (comportamento já
  existente, inalterado)

### AC-4: Sync responde imediato
- **Dado** um usuário com `pcm='escrita'` clicando "Sincronizar Auvo"
- **Quando** a requisição é enviada
- **Então** `pcm-auvo-sync-all` responde em menos de 1s com `{ runId, status: 'running' }`,
  sem esperar nenhum pull terminar

### AC-5: Continua em background
- **Dado** um sync em andamento (`runId` retornado)
- **Quando** o usuário navega para outra página ou fecha a aba
- **Então** o processamento continua no servidor até concluir (via `EdgeRuntime.waitUntil`),
  gravando o resultado final em `pcm.auvo_sync_runs`

### AC-6: Progresso visível
- **Dado** um sync em andamento
- **Quando** a UI está na página do dashboard PCM
- **Então** mostra estado "sincronizando" (mesmo visual de hoje) enquanto
  `auvo_sync_runs.status='running'`, e o resultado (ok/etapas com erro) quando terminar — via
  polling de 3s na tabela, sem Edge Function nova

### AC-7: Retomar acompanhamento ao voltar
- **Dado** um sync iniciado, usuário saiu da página antes de terminar
- **Quando** o usuário volta pro dashboard PCM enquanto o sync ainda está rodando
- **Então** a página detecta a run mais recente com `status='running'` (< 10 min) e volta a
  mostrar "sincronizando" com polling, em vez do botão ocioso

### AC-8: Cron horário
- **Dado** a migration desta story aplicada
- **Quando** consultado `cron.job`
- **Então** `pcm_auvo_tasks_import_diario` roda a cada hora (`0 * * * *`) em vez de 1x/dia

## Fora de escopo
> Vinculante.
- Cursor incremental para `tickets`/`gps`/`expenses`/`satisfactions`/`questionnaires` — `product.md` §Non-goals.
- Notificação fora da página quando o sync termina (só polling com página aberta).
- Fila/job genérico reutilizável para outras operações — só este botão por ora.

## Rastreabilidade
- Origem: ideia do PO 2026-07-13, ver `product.md`.
- Arquivos-âncora: `supabase/functions/pcm-auvo-tasks-import/index.ts`,
  `supabase/functions/pcm-auvo-sync-all/index.ts`, migration nova (`pcm.auvo_sync_runs` + ajuste
  de cron de `0038`), `apps/web/src/features/pcm/application/sincronizar-auvo-gateway.ts`,
  `infrastructure/supabase-sincronizar-auvo-adapter.ts`, `pages/PcmDashboardPage.tsx`.
- Precedente de padrão: `EdgeRuntime.waitUntil` já usado em
  `supabase/functions/pcm-whatsapp-webhook/index.ts`.
