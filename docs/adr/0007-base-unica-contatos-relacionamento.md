---
name: adr-0007-base-unica-contatos-relacionamento
description: ADR — Base única de contatos sem substituir PCM/Comercial/Atendimento.
alwaysApply: false
---

# ADR-0007 — Base Única de Contatos e Relacionamento

## Status
Aceita.

## Contexto
`pcm.clientes`, `comercial.leads` e `atendimento.conversas` representam coisas diferentes, mas
podem apontar para a mesma pessoa/canal. Duplicar telefone/nome em cada domínio dificulta histórico,
deduplicação e handoff entre atendimento e comercial.

## Decisão
Criar `relacionamento` como schema transversal para `contatos`, `identidades_contato` e `vinculos`.
Os domínios continuam donos das entidades operacionais; contato é a identidade relacional comum.

## Consequências
- Atendimento e Comercial passam a apontar para `contato_id`.
- `pcm.clientes` segue como fonte de verdade do condomínio/cliente.
- Timeline de relacionamento pode agregar eventos sem mover dados entre domínios.
