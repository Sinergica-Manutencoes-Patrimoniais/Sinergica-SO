---
name: spec
description: Contrato — botão global "Sincronizar Auvo" que puxa todas as entidades do Auvo on-demand.
alwaysApply: true
---

# Spec — Botão global "Sincronizar Auvo" (pull on-demand)

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Hoje o botão "Atualizar" do dashboard PCM só relê tabelas cache locais `pcm.*` — não puxa nada do
> Auvo. Tarefas do Auvo só viram OS via cron diário 05:00. Requisito: um botão que puxe do Auvo na hora,
> enquanto os writes continuam instantâneos (E01-S36).

## Resumo
Um botão global "Sincronizar Auvo" no header do PCM dispara, sob demanda, o pull de todas as entidades
(catálogos + tarefas→OS) via uma função orquestradora, mostrando progresso e "última sincronização"; o
refresh de cada página continua lendo o cache local (rápido).

## Critérios de aceite

### AC-1: Botão dispara pull de todas as entidades
- **Dado** o botão "Sincronizar Auvo" no header do PCM
- **Quando** clicado
- **Então** uma função orquestradora `pcm-auvo-sync-all` invoca o pull de cada entidade
  (`pcm-auvo-pull` por entidade) + `pcm-auvo-tasks-import`, cobrindo as mesmas entidades do cron

### AC-2: Tarefas abertas do Auvo aparecem como OS aberta
- **Dado** tarefas no Auvo sem OS correspondente no PCM
- **Quando** o sync termina
- **Então** elas aparecem como OS aberta em `pcm.ordens_servico` (`origem='auvo'`, via `os-from-task.ts`
  já existente de E01-S34), visíveis nas telas de OS/dashboard

### AC-3: Progresso e resultado visíveis, erro parcial reportado
- **Dado** o sync em andamento
- **Quando** ele roda
- **Então** a UI mostra estado de progresso e, ao fim, timestamp de "última sincronização"; se uma
  entidade falhar, o erro é reportado por entidade (não engole nem aborta as demais) e reflete na
  saúde de sync (`E00-S11`)

### AC-4: Refresh por página continua lendo cache (não puxa do Auvo)
- **Dado** o botão "Atualizar" existente em cada página
- **Quando** clicado
- **Então** ele relê as tabelas `pcm.*` locais (rápido), sem chamar o Auvo — só o botão global puxa

## Casos de borda e erros
- Sync já em andamento: botão desabilita/enfileira, não dispara dois pulls concorrentes da mesma entidade.
- Uma entidade falha (Auvo 5xx): as outras completam; resultado agregado marca a que falhou.
- Sync longo: UI não bloqueia (assíncrono); o timestamp só atualiza quando cada pull confirma.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Deploy/secrets — `E01-S35`. Write path — `E01-S36`. Saúde de sync/badge — `E00-S11`.
- Mudar a lógica de mapeamento tarefa→OS (`os-from-task.ts`) — reusar como está.
- Sync em tempo real por websocket — fora; é on-demand + cron + webhook.

## Rastreabilidade
- Product: `./product.md`
- Relacionadas: `E01-S34` (reconciliação/tasks-import), `E01-S23` (poller `pcm-auvo-pull`), `E00-S11` (saúde).
- Arquivos-âncora: `apps/web/.../PcmDashboardPage.tsx`, `supabase/functions/pcm-auvo-pull`,
  `supabase/functions/pcm-auvo-tasks-import`, novo `supabase/functions/pcm-auvo-sync-all`.
