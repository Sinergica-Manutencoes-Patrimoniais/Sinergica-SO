---
name: "docs-adr-1299-cancelamento-criacao-visita-incerta-md"
description: "Documento Sinérgica SO: ADR-1299 — Cancelamento de criação de Visita incerta"
alwaysApply: false
---

# ADR-1299 — Cancelamento de criação de Visita incerta

## Contexto

Perder a resposta da criação não prova que a Visita deixou de ser criada. Substituir o request local pode produzir duplicidade se a primeira transação chegar depois.

## Decisão

Registrar cancelamento por request, ator, Cliente, payload e motivo, sob a mesma trava transacional da criação. Se já houver recibo do pedido exato, devolvê-lo sem cancelar a Visita; caso contrário, registrar impedimento durável para aquele request. A criação deve recusar o impedimento sob a mesma trava. Gate de cancelamento nasce fechado e exige capacidade atual. A operação não cancela Visita existente, não altera histórico e não chama Auvo.

## Consequências

Somente resposta confirmada de cancelamento permite liberar a tentativa local. Falha ou perda de resposta preserva os mesmos dados para repetição. Rollout requer substituir a função de criação antes de abrir o gate e validar locks, RLS, concorrência, revogação, replay e revisão adversarial.
