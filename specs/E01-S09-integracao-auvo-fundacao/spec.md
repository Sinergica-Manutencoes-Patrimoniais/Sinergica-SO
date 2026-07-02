---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Integração Auvo: Fundação (cliente HTTP, sync de clientes, criação de task)

> **Fonte da verdade.** Status: aprovado (estudo/planejamento — ver `docs/STATE.md`)
> Tier: Arquitetural (integração externa nova, decisão irreversível de idempotência/contrato de
> dados). `design.md` obrigatório e presente.

## Resumo
O PCM passa a criar e manter automaticamente, no Auvo, o cliente e a task correspondentes a cada
condomínio e OS que entra em execução de campo — sem duplicar e sem bloquear o fluxo do PCM se o
Auvo falhar.

## Critérios de aceite

### AC-1: Sync de cliente cria registro novo no Auvo
- **Dado** um `pcm.clientes` com `auvo_id IS NULL`
- **Quando** a Edge Function `pcm-auvo-customers-sync` é invocada para esse cliente
- **Então** ela busca no Auvo por `externalId = clientes.id`; se não encontrar, cria via
  `POST /customers` e grava o `customerId` retornado em `pcm.clientes.auvo_id`.

### AC-2: Sync de cliente é idempotente
- **Dado** um `pcm.clientes` com `auvo_id` já preenchido
- **Quando** a Edge Function `pcm-auvo-customers-sync` é invocada de novo para o mesmo cliente
- **Então** nenhuma chamada `POST /customers` é feita (no máximo `PUT /customers/{id}` se algum
  campo espelhado mudou) — nunca cria um segundo cliente Auvo para o mesmo `pcm.clientes.id`.

### AC-3: Cliente já existente no Auvo (criado manualmente antes desta integração) é vinculado, não duplicado
- **Dado** um `pcm.clientes` com `auvo_id IS NULL`, mas já existe um cliente no Auvo com
  `externalId` igual ao `clientes.id` (cenário de migração/uso manual anterior)
- **Quando** a Edge Function `pcm-auvo-customers-sync` é invocada
- **Então** ela encontra via `GET /customers?paramFilter={externalId}`, não cria um novo, e só
  grava o `customerId` encontrado em `pcm.clientes.auvo_id`.

### AC-4: OS entra em `planejamento` → task criada no Auvo
- **Dado** uma OS com `status = 'solicitacao'` (ou `corretiva`) cujo cliente já tem `auvo_id`
  preenchido, e `categoria` com `taskTypeId` mapeado (`corretiva`, `preventiva` ou `inspecao`)
- **Quando** a OS transiciona para `status = 'planejamento'`
- **Então** a Edge Function `pcm-auvo-create-task` é disparada (via trigger assíncrono `pg_net`),
  cria a task via `POST /tasks` com `externalId = os.id`, `customerId = cliente.auvo_id`,
  `taskTypeId` mapeado e `priority` derivado do GUT, e grava `auvo_task_id`,
  `auvo_sync_status = 'synced'`, `auvo_synced_at = now()` na OS.

### AC-5: Criação de task é idempotente
- **Dado** uma OS que já tem `auvo_task_id` preenchido
- **Quando** a Edge Function `pcm-auvo-create-task` é invocada de novo para a mesma OS (ex.:
  reprocessamento de trigger)
- **Então** ela busca por `externalId = os.id` no Auvo antes de criar; encontra a task existente
  e não cria uma segunda — no-op se já `synced`.

### AC-6: Falha na criação de task não bloqueia a transição de status da OS
- **Dado** a API do Auvo indisponível ou retornando erro
- **Quando** uma OS transiciona para `planejamento`
- **Então** o `UPDATE` de status da OS no PCM é bem-sucedido de qualquer forma (é assíncrono via
  `pg_net`); a OS fica com `auvo_sync_status = 'failed'` e `auvo_sync_error` preenchido com a
  mensagem/`X-Request-Id` do erro, sem exceção propagada ao usuário do PCM.

### AC-7: Categoria sem `taskTypeId` mapeado não tenta criar task
- **Dado** uma OS com `categoria = 'levantamento'` ou `'emergencial'` (sem `taskTypeId` Auvo
  confirmado — ver `design.md` → Questões em aberto)
- **Quando** a OS transiciona para `planejamento`
- **Então** nenhuma chamada `POST /tasks` é feita; `auvo_sync_status` fica `'failed'` com
  `auvo_sync_error = 'taskTypeId não configurado para categoria <categoria>'` — comportamento
  explícito, não silencioso.

## Matriz de decisão (opcional)
| `categoria` da OS | `taskTypeId` Auvo | Comportamento | AC |
|---|---|---|---|
| `corretiva` | `228714` | Cria task | AC-4 |
| `preventiva` | `139989` | Cria task | AC-4 |
| `inspecao` | `179776` | Cria task | AC-4 |
| `levantamento` | não configurado | Falha explícita, sem tentar criar | AC-7 |
| `emergencial` | não configurado | Falha explícita, sem tentar criar | AC-7 |

## Casos de borda e erros
- Cliente sem `auvo_id` no momento em que a OS entra em `planejamento`: `pcm-auvo-create-task`
  chama `pcm-auvo-customers-sync` como fallback síncrono antes de tentar criar a task (não é a
  via principal — a via principal é o cliente já ter sido sincronizado antes, ex. no cadastro).
- Auvo retorna 401 (token expirado no meio da chamada): cliente HTTP compartilhado invalida o
  cache e tenta login de novo, 1 retry automático — só propaga erro se o retry também falhar.
- Auvo retorna 429 (rate limit): 1 retry com backoff; se persistir, trata como falha (AC-6).
- `X-Request-Id` de toda resposta Auvo é logado junto com timestamp UTC, mesmo em sucesso —
  necessário para abrir chamado de suporte Auvo se algo divergir depois (guia SLA do mapeamento).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Processar webhooks/eventos vindos do Auvo (status de execução, fotos, checklist) — `E01-S10`.
- Sync de técnicos, equipes ou equipamentos — `E01-S11`.
- Fila/cron de reconciliação automática para `auvo_sync_status = 'failed'` — fase 2 do roadmap
  em `design.md`, sem story aberta ainda.
- Tela de UI mostrando conflitos de sync — story futura do Hub de OS (`E01-S07`).
- Despacho automático a partir do Agente Zé — explicitamente fora do escopo de `E01-S02`
  também; esta spec não reabre essa decisão.
- Definir os `taskTypeId` de `levantamento`/`emergencial` — decisão de produto do Fabrício,
  bloqueante para AC-7 deixar de existir (ver `design.md` → Questões em aberto).

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md` · Domínio: `./domain.md`
- ADRs relacionados: `docs/adr/0001-pcm-origin-truth-externalid.md`
- Blueprint de origem: `docs/blueprint/integracoes/auvo.md`, `docs/blueprint/01-pcm-operacao.md`
- Mapeamento de API consultado: `Auvo-API-Mapeamento-Completo.md` (vault Obsidian, Sinérgica)
