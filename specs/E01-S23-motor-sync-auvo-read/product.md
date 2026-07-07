---
name: product
description: PRD-lite — motor de sync bidirecional PCM↔Auvo (metade read), segunda story da épica "PCM como front-end completo do Auvo".
alwaysApply: false
---

# Product — Motor de sync Auvo (read path: dispatcher de webhook + poller)

> **Tier:** arquitetural · **Status:** aprovado
> Reusa `design.md`/`domain.md` de [`E01-S22`](../E01-S22-motor-sync-auvo-write/design.md) (adendo
> "Read path" no mesmo arquivo) — mesmo padrão de `E01-S10`/`E01-S11` reusando o design de
> `E01-S09`. Depende de `E01-S22` implementada (registry, `fn_apply_auvo_sync`).

## Problema
`E01-S22` entrega o sentido PCM→Auvo (outbox). Sem o sentido inverso, qualquer edição feita
**no Auvo** (um técnico corrige o telefone de um cliente pelo app, o Auvo desativa um funcionário
desligado) nunca chega ao PCM — o Fabrício veria dado desatualizado no painel que deveria
substituir o Auvo para ele. O motor de sync só está completo com os dois sentidos.

## Para quem
Fabrício e demais colaboradores do escritório — qualquer tela CRUD que `E01-S24`+ construir só
mostra dado confiável se o read path já estiver entregando as atualizações do Auvo.

## Resultado esperado / métrica de sucesso
- Métrica: latência entre uma mudança no Auvo e o reflexo no PCM.
- Alvo: **tempo real** (segundos) para as 5 entidades com webhook (User, Customer, Equipment,
  Ticket, + Task já existente); **≤24h** para o resto via poller diário/6h.

## Goals
- Generalizar o webhook Auvo existente (`pcm-auvo-webhook`, hoje só processa `entity=Task`) para
  despachar por entidade via o registry, sem alterar o handler de Task já em produção.
- Um poller genérico (`pcm-auvo-pull`) reutilizável por qualquer descriptor com `cronSchedule`.
- Auto-registro dos webhooks Auvo (`POST /webhooks`) pelas 4 entidades novas.

## Non-goals
- Alterar o handler de Task (`E01-S10`) — só adiciona um `switch` novo antes dele.
- Qualquer descriptor concreto de entidade — entram em `E01-S24`+, que só *usa* o dispatcher/poller
  aqui construídos.
- Financeiro (Invoice) — descartado pelo usuário na épica; o registry suporta `webhookEntity: 50`
  tecnicamente, mas nenhum descriptor o usa.

## Riscos / premissas
- Premissa: o formato de entrega do webhook para as 4 entidades novas segue o mesmo envelope já
  observado para Task (`entity`/`action` numéricos + payload leniente) — não confirmado contra
  produção para User/Customer/Equipment/Ticket especificamente.
- Risco: reentrega duplicada de webhook (rede) — mitigado pelo upsert-por-`auvo_id` ser idempotente
  por natureza (reaplicar o mesmo patch não muda o resultado).
