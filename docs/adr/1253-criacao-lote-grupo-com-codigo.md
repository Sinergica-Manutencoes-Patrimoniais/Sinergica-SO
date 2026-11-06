---
name: "docs-adr-1253-criacao-lote-grupo-com-codigo-md"
description: "Documento Sinérgica SO: ADR-1253 — Grupos com código em lote"
alwaysApply: false
---

# ADR-1253 — Grupos com código em lote

**Status:** proposta local, não homologada. Complementa ADR-1252.

Preparar a criação em lote para transmitir o código explicitamente conferido de cada Grupo à incorporação individual já protegida por revisão do staging e gate. Os atributos, revisões, IDs de tentativa e códigos fazem parte do pedido idempotente; erro em qualquer item reverte o lote inteiro. Linhas sem código permanecem compatíveis. A função continua privada, acessível apenas pela mediação existente.

Antes de abrir gates, validar todos os escritores/reservas, colisões entre itens, revisão concorrente, resposta perdida, rollback integral, locks, autorização/revogação, ACL/RLS e revisão adversarial. Não criar tarefas Auvo nem apagar código anterior.
