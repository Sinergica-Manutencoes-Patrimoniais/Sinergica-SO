---
name: "docs-adr-0766-e01-s168-gates-finalizacao-concorrente-md"
description: "Documento Sinérgica SO: ADR-0766 — Serialização dos gates de finalização"
alwaysApply: false
---

# ADR-0766 — Serialização dos gates de finalização

**Status:** preparada, sem homologação. **Data:** 2026-10-30.

## Contexto

Em teste isolado, um mediador iniciou com gate aberto, esperou a OS e finalizou depois que outro processo fechou o gate. Uma verificação inicial sem lock não serializa o desligamento com o efeito.

## Decisão

O mediador mutável adquire locks compartilhados nos seis gates que governam a finalização, em ordem fixa, e mantém esses locks até o fim da transação. O desligamento concorrente aguarda operação já autorizada; se o desligamento confirmar primeiro, uma operação posterior observa gate fechado e falha. O cálculo e as mutações continuam na função já existente; não há acesso ao Auvo.

## Limites

Nenhum gate é aberto por esta migration. Esta decisão não prova serialização de revogações de capacidade ou alterações de histórico, que dependem de outras linhas e locks. São necessários testes concorrentes, revisão adversarial e CI antes de homologar.
