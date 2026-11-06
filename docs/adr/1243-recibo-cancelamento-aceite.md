---
name: "docs-adr-1243-recibo-cancelamento-aceite-md"
description: "Documento Sinérgica SO: ADR-1243 — Recibo do cancelamento de aceite"
alwaysApply: false
---

# ADR-1243 — Recibo do cancelamento de aceite

## Decisão

Preparar consulta autenticada do recibo de cancelamento pelo mesmo ator, Cliente, aceite, requestId e motivo. A consulta não repete a escrita. A interface preserva a tentativa quando o recibo não está disponível e só a limpa após conferir sessão e conteúdo.

## Limites

Ausência de recibo não comprova falha ou término do pedido em andamento. Gates seguem fechados. Validar autorização, revogação, transação concorrente, replay, privacidade, armazenamento local e revisão adversarial antes de habilitar. Não cancela ou reverte lote.
