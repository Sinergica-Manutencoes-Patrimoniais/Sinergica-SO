---
name: design-E09-S09-portal-aprovacao-orcamento
description: Design — aprovação/recusa de orçamento pelo síndico no portal, com aceite registrado; fecha o gate de "papel da Área do Cliente" que bloqueia E01-S14 (Fluxo B).
alwaysApply: false
---

# Design — Aprovação de orçamento no portal

> **Tier arquitetural-lite.** Toca o estado do orçamento (E01-S14, hoje bloqueado). Aprovar antes de codar.

## Problema
O Fluxo B (E01-S14: chamado → requisição → orçamento → aceite → OS) está **bloqueado** justamente em
"papel da Área do Cliente no MVP" (ROADMAP:65). O portal resolve o elo que faltava: o **síndico
aprova ou recusa o orçamento** e o aceite fica registrado, disparando (ou não) a virada em OS.

## Contexto atual (AS-IS)
- E01-S14 tem só `design.md` (entidade pré-OS + orçamento, vira OS após aceite), implementação parada
  nas 2 perguntas: orçamento recusado e papel da Área do Cliente. Esta story responde a 2ª.
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
- Depende de E01-S14 definir a entidade de orçamento; esta story adiciona a **superfície de aceite**
  do cliente + RLS por `cliente_id` + registro de aceite.
- Coordenar com E01-S14 (destravar juntos): esta story é a resposta à pergunta que o bloqueia.

## Riscos
- Se E01-S14 não estiver modelada, esta story fica bloqueada — sinalizar dependência dura.
- Aceite precisa ser inequívoco (append-only + carimbo) para valor jurídico/comercial.
