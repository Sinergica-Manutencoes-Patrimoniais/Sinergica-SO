---
name: design-E09-S09-portal-aprovacao-orcamento
description: Design — aprovação/recusa de orçamento pelo síndico no portal, com aceite registrado; fecha o gate de "papel da Área do Cliente" que bloqueia E01-S14 (Fluxo B).
alwaysApply: false
---

# Design — Aprovação de orçamento no portal

> **Tier arquitetural-lite.** Decisão implementada pela migration `0144`, que entrega o recorte de
> orçamento necessário ao portal e destrava o elo de aceite do Fluxo B.

## Problema
O Fluxo B (E01-S14: chamado → requisição → orçamento → aceite → OS) estava **bloqueado** justamente em
"papel da Área do Cliente no MVP" (ROADMAP:65). O portal resolve o elo que faltava: o **síndico
aprova ou recusa o orçamento** e o aceite fica registrado, disparando (ou não) a virada em OS.

## Contexto atual (AS-IS)
- A migration `0144` implementa requisição, orçamento, decisão append-only e virada em OS no recorte
  necessário; evoluções do fluxo interno continuam sob E01-S14.
- Fundação do portal (E09-S01) dá auth/isolamento por `cliente_id`.

## Decisões
### D1 — O portal é o ponto de aceite do orçamento
O síndico vê os orçamentos **pendentes de aprovação** do seu condomínio e registra
**aprovar/recusar** com carimbo (quem/quando; opcional: comentário na recusa). O aceite é a transição
que E01-S14 esperava do "cliente".

### D2 — Aceite é append-only e não-repudiável
Registrar o evento de aprovação/recusa append-only (autor=síndico, timestamp, IP/sessão se possível),
para valer como aceite. Reusa o padrão de eventos append-only (os_status_eventos/chamado).

### D3 — Recusa não descarta silenciosamente
Recusar mantém o orçamento com status `recusado` + motivo; o time interno decide (revisar/reofertar/
encerrar). Fecha a 1ª pergunta de E01-S14 do lado do portal (o tratamento interno completo é E01-S14).

### D4 — Só orçamento do próprio condomínio
RLS por `cliente_id` — síndico só vê/aprova orçamento do seu condomínio.

## Alternativas descartadas
- **Aceite por e-mail/WhatsApp** — não rastreável/não-repudiável como o portal.
- **Auto-virar OS sem aceite explícito** — perde o consentimento do cliente (razão do Fluxo B).

## Impacto
- O recorte mínimo de E01-S14 foi implementado junto da **superfície de aceite** do cliente, RLS por
  `cliente_id` e registro append-only.

## Riscos
- Evoluções no fluxo interno devem preservar o contrato e a imutabilidade entregues pela migration 0144.
- Aceite precisa ser inequívoco (append-only + carimbo) para valor jurídico/comercial.
