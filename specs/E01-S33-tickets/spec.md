---
name: spec
description: Contrato — CRUD (parcial) de Tickets no PCM, sincronizado com Auvo /tickets (webhook Ticket=62), sem DELETE e com PATCH limitado a status/externalId.
alwaysApply: true
---

# Spec — Tickets

> **Fonte da verdade.** Status: aprovado com escopo reduzido pela API · Tier: Pequeno
> Endpoint: `/tickets`. Webhook `Ticket` (entity=62) — última entidade da leva com tempo real.
> **`PATCH` só documenta `externalId`/`statusId` como editáveis** — título/descrição/etc não têm
> caminho de edição documentado; **sem `DELETE`** documentado.

## Resumo
Tickets (chamados de central de atendimento do Auvo, diferente da OS do PCM) ganham criação e
mudança de status pelo PCM, com leitura em tempo real via webhook.

## Contexto específico (ler antes de implementar)
- `POST /tickets/`: `title`, `description`, `requestTypeId`, `statusId`, `requesterEmail`,
  `requesterName`, `customerId` (resolver de `pcm.clientes.auvo_id`), `teamId` (resolver de
  `pcm.equipes.auvo_id`, `E01-S32`), `userResponsableId` (resolver de `auvo_user_id`),
  `equipmentId`/`equipmentIds`, `priority`, `externalId`, `customFields[]`. Idempotência real via
  `externalId`.
- `PATCH /tickets/{id}`: só `externalId`/`statusId` documentados como editáveis. **`toAuvo` de
  update desta entidade só deve mapear `statusId`** — editar título/descrição/prioridade no PCM
  fica só local (mesmo espírito de `E01-S32`, mas no nível de campo, não de entidade inteira; não
  precisa de `supportsUpdate:false`, só um `toAuvo` mais restrito que os outros).
- **Sem `DELETE` documentado**: `deleteStrategy:'unsupported'` — "excluir" um Ticket no PCM é só
  soft-delete local (ou melhor: a UI deveria oferecer "arquivar" em vez de "excluir", já que
  Tickets provavelmente não devem ser apagados de verdade — decisão de UX na implementação).
- `GET /tickets/request-type` e `GET /tickets/status` são listas de referência (read-only) para
  popular os `<select>` de `requestTypeId`/`statusId` no formulário — não são entidades CRUD,
  buscar sob demanda ou cachear com TTL curto, não pelo motor genérico.
- Webhook `Ticket` (62) — dispatcher de `E01-S23` já cobre.

## Critérios de aceite

### AC-1: Criar Ticket propaga ao Auvo com idempotência real
- **Dado** um usuário com `podeAcessar('pcm','escrita')` abre um Ticket (título, cliente, tipo de
  solicitação, prioridade)
- **Quando** salva
- **Então** `pcm.tickets` ganha a linha, o outbox enfileira, o drain cria em `/tickets/` com
  `externalId = row.id`, grava `auvo_id`

### AC-2: Mudar status propaga como PATCH (só `statusId`)
- **Dado** um Ticket sincronizado
- **Quando** o usuário muda o status no PCM
- **Então** o drain envia `PATCH [{op:"replace",path:"statusId",value:...}]` — só o status, nunca
  título/descrição (que não têm caminho de edição documentado)

### AC-3: Excluir/arquivar Ticket é só local
- **Dado** a ausência de `DELETE` documentado
- **Quando** o usuário arquiva um Ticket no PCM
- **Então** fica só local (`deleteStrategy:'unsupported'`), sem chamada ao Auvo

### AC-4: Mudança no Auvo chega ao PCM em tempo real (webhook)
- **Dado** um Ticket criado/atualizado no Auvo (ex.: cliente responde por outro canal)
- **Quando** o webhook `Ticket` chega
- **Então** `pcm.tickets` é atualizado (upsert por `auvo_id`) via `fn_apply_auvo_sync`

### AC-5: Formulário usa listas de referência ao vivo
- **Dado** o formulário de novo Ticket
- **Quando** aberto
- **Então** `requestTypeId`/`statusId` vêm de `GET /tickets/request-type`/`GET /tickets/status`
  (chamada direta, não pelo motor genérico — são listas de referência, não entidades
  sincronizadas)

### AC-6: Tela com gate de permissão + RLS FORCE
- Mesmo padrão das demais entidades.

## Casos de borda e erros
- Ticket sem `customerId` resolvível (cliente não sincronizado): bloquear criação com mensagem
  clara.
- `equipmentIds` referenciando equipamento não sincronizado: permitir Ticket sem equipamento
  vinculado (campo opcional).

## Fora de escopo
- Editar título/descrição/prioridade com propagação ao Auvo (API não documenta caminho).
- `customFields` (campos customizados por conta Auvo) — fora de escopo, sem UI genérica para
  isso nesta leva.
- Interações/histórico de modificações do Ticket (`searchInteractions`/`searchModifications` do
  `GET` de lista) — leitura básica só, sem timeline rica (diferente do que `E01-S15` fez para OS).

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}`,
  `../E01-S23-motor-sync-auvo-read/spec.md` (webhook Ticket)
- Depende de: `../E01-S27-clientes-crud-grupos/spec.md` (customerId), `../E01-S32-equipes/spec.md`
  (teamId), `../E01-S28-funcionarios/spec.md` (userResponsableId)
