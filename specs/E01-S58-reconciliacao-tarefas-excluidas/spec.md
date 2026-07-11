---
name: spec
description: Contrato — reconciliação de tarefas excluídas no Auvo (/tasks/GetDeletedTasks) para cancelar OS órfãs locais.
alwaysApply: true
---

# Spec — Reconciliação de tarefas excluídas no Auvo

> **Fonte da verdade.** Status: rascunho · Tier: Trivial/Pequeno
> Origem: `docs/AUDITORIA-AUVO-API.md`. A API expõe `GET /tasks/GetDeletedTasks`. Hoje, se alguém
> exclui uma tarefa no Auvo, a OS local correspondente fica **aberta para sempre** — infla KPIs de
> abertas, backlog e o Kanban com fantasmas. Nenhum caminho atual (webhook/cron/import) cobre exclusão.

## Resumo
Etapa nova no sync (`pcm-auvo-sync-all`/cron): consulta tarefas excluídas na janela e marca as OS
locais correspondentes como `cancelado`, com trilha de auditoria (motivo `excluida_no_auvo`).

## Critérios de aceite

### AC-1: OS de tarefa excluída é cancelada
- **Dado** uma OS local com `auvo_task_id` cuja tarefa foi excluída no Auvo
- **Quando** a reconciliação roda
- **Então** a OS muda para `cancelado` (registrando o evento em `pcm.os_status_eventos` como todo
  outro status) — nunca hard-delete de OS

### AC-2: Idempotência
- **Dado** a mesma tarefa excluída aparecendo em execuções seguidas
- **Quando** a reconciliação roda de novo
- **Então** não gera evento duplicado nem mexe em OS já cancelada

### AC-3: OS finalizada não regride
- **Dado** uma OS já `finalizado`/`faturado` cuja tarefa foi excluída depois
- **Quando** a reconciliação roda
- **Então** a OS não muda de status (histórico executado vale mais que a exclusão) — apenas loga

### AC-4: Visibilidade
- **Dado** OS canceladas por exclusão
- **Quando** listadas
- **Então** o motivo é distinguível (evento/observação), sem inventar coluna nova se o evento cobrir

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Recriar tarefa excluída, lixeira/undelete local.
- Exclusões de outras entidades (clientes etc. — reconciliação de sumidos já existe no motor).

## Rastreabilidade
- Auditoria: `docs/AUDITORIA-AUVO-API.md` · Motor: E01-S34 (reconciliação), E01-S37 (sync-all).
- Contrato API: `GET /tasks/GetDeletedTasks` — verificar shape/filtros reais com credencial.
- Arquivos-âncora: `supabase/functions/pcm-auvo-tasks-import/` ou etapa própria em
  `pcm-auvo-sync-all`, `pcm.os_status_eventos`.
