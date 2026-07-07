---
name: spec
description: Contrato — liga o cron real do motor genérico (9 entidades) + Tickets, e faz OS/Tarefas do Auvo aparecerem no PCM (webhook cria quando não acha local + import de reconciliação).
alwaysApply: true
---

# Spec — Reconciliação Auvo→PCM

> **Fonte da verdade.** Status: aprovado · Tier: arquitetural
> Depende de: `E01-S22`/`E01-S23` (motor genérico), `E01-S24`-`S33` (descriptors existentes).

## Critérios de aceite

### AC-1: Entidades com `cronSchedule` declarado são puxadas de verdade
- **Dado** um descriptor com `cronSchedule` no registry (`tipos_tarefa`, `segmentos`,
  `palavras_chave`, `produto_categorias`, `equipamento_categorias`, `cliente_grupos`,
  `ferramentas`, `servicos`, `equipes`)
- **Quando** o horário do `pg_cron` correspondente chega
- **Então** `pcm-auvo-pull` é chamado para cada entidade daquele grupo, na ordem, com um intervalo
  entre chamadas (não simultâneo)

### AC-2: Tickets ganha reconciliação por cron, além do webhook
- **Dado** o descriptor de Tickets
- **Quando** o job horário de Tickets dispara
- **Então** `pcm-auvo-pull` é chamado para `tickets`

### AC-3: Tarefa nova no Auvo cria OS no PCM em tempo real (quando o cliente já está sincronizado)
- **Dado** um webhook de Task chega pro `auvo_task_id` que não existe em `pcm.ordens_servico`
- **Quando** o `customerId` da tarefa resolve para um `pcm.clientes.auvo_id` existente
- **Então** uma OS nova é criada (`origem='auvo'`, `categoria='corretiva'`, `numero` sequencial,
  `status` resolvido pela máquina de transição existente, `auvo_task_id` vinculado) e o fluxo
  segue normalmente (snapshot rico, vínculo de equipamento)

### AC-4: Tarefa nova no Auvo com cliente ainda não sincronizado não quebra o webhook
- **Dado** o `customerId` da tarefa não resolve pra nenhum `pcm.clientes.auvo_id`
- **Quando** o webhook processa
- **Então** loga aviso estruturado e responde 200 sem criar OS (comportamento idempotente — pode
  ser pega depois pelo import de reconciliação, AC-5)

### AC-5: Import de reconciliação faz backfill de tarefas antigas
- **Dado** uma tarefa no Auvo sem `pcm.ordens_servico.auvo_task_id` correspondente (criada antes
  desta mudança, ou perdida por falha de webhook)
- **Quando** `pcm-auvo-tasks-import` roda (cron diário ou invocação manual)
- **Então** a OS é criada com a mesma lógica de AC-3/AC-4 — nunca faz soft-delete de OS que
  sumiram do Auvo (assimetria intencional, ver `design.md`)

### AC-6: Nenhuma regressão no fluxo de OS já conhecida
- **Dado** um webhook de Task pra um `auvo_task_id` que já tem OS local
- **Quando** processado
- **Então** comportamento idêntico a antes desta story (só `UPDATE`, sem tentar criar de novo)

## Casos de borda e erros
- `pcm-auvo-tasks-import` numa página com erro de rede: mesma guarda de `pcm-auvo-customers-import`
  — propaga o erro, nenhuma escrita parcial acontece (a paginação inteira precisa ter sucesso antes
  de qualquer INSERT).
- Duas tarefas do Auvo mapeando pro mesmo `numero` gerado por `count()` concorrente: mesma dívida
  já documentada em `E01-S02`/`pcm-ze-agent` — não resolvida aqui, só herdada conscientemente.

## Fora de escopo
- Ver `product.md` → Non-goals.

## Rastreabilidade
- Design: `design.md` (este diretório).
- Depende de: `E01-S22`/`E01-S23` (motor genérico), `E01-S13` (padrão de import de reconciliação),
  `E01-S10`/`E01-S15` (webhook de Task original).
