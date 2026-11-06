---
name: "docs-adr-1466-visibilidade-materiais-mediada-md"
description: "Documento Sinérgica SO: ADR-1466 — Visibilidade de materiais mediada"
alwaysApply: false
---

# ADR-1466 — Visibilidade de materiais mediada

Prepara acesso autenticado ao estado, histórico e comando de retirada ou republicação de material. A entrada confere ator, Cliente, lista e autorização atual; os núcleos existentes preservam o histórico e as regras de revisão e idempotência. Gate e opção da interface iniciam desligados.

O comando obtém a trava do pedido antes da lista, seguindo a ordem do núcleo. Migration e interface ainda não foram testadas nem aplicadas. Validar permissões, revogação, concorrência, ordem de todas as travas, replay, isolamento entre Clientes e revisão adversarial antes de ativar.
