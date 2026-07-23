---
name: spec-E09-S09-portal-aprovacao-orcamento
description: Contrato — síndico aprova/recusa orçamento no portal com aceite registrado (append-only), destravando o papel do cliente no Fluxo B (E01-S14).
alwaysApply: true
tier: arquitetural
---

# Spec — Aprovação de orçamento no portal

> **Fonte da verdade.** Status: aprovado (após `design.md`). Depende de E09-S01 e **E01-S14** (Fluxo B).

## Resumo
O síndico vê os orçamentos pendentes do seu condomínio e **aprova ou recusa**, com o aceite
registrado de forma não-repudiável. Esta é a resposta à pergunta "papel da Área do Cliente" que hoje
bloqueia o E01-S14.

## Critérios de aceite

### AC-1: Ver orçamentos pendentes do próprio condomínio
- **Dado** um síndico logado
- **Quando** abre a seção Orçamentos
- **Então** vê os orçamentos pendentes de aprovação do **seu** condomínio (escopo `cliente_id`), com
  itens/valor propostos.

### AC-2: Aprovar orçamento
- **Dado** um orçamento pendente
- **Quando** o síndico aprova
- **Então** registra-se um aceite append-only (autor=síndico, timestamp), o orçamento vira `aprovado`
  e dispara a continuação do Fluxo B (virar OS — mecânica em E01-S14).

### AC-3: Recusar orçamento
- **Dado** um orçamento pendente
- **Quando** o síndico recusa (com motivo)
- **Então** o orçamento vira `recusado` com o motivo registrado; não é descartado silenciosamente (o
  tratamento interno é E01-S14).

### AC-4: Não-repúdio e isolamento
- **Dado** o aceite/recusa
- **Quando** registrado
- **Então** é append-only (não editável) e escopado ao `cliente_id`; síndico nunca vê/aprova
  orçamento de outro condomínio.

## Casos de borda e erros
- Orçamento já decidido → não permite nova decisão pelo síndico.
- Orçamento expirado → estado próprio, não aprovável.
- E01-S14 ainda não modelado → story bloqueada (dependência dura).

## Fora de escopo (vinculante)
- Modelagem da entidade de orçamento e a virada em OS — E01-S14.
- Precificação/edição do orçamento — interno.

## Rastreabilidade
- Design: `./design.md`
- `apps/web/src/features/area-cliente/` (seção Orçamentos)
- Depende de E01-S14 (entidade de orçamento) + RLS por `cliente_id` + registro de aceite append-only
