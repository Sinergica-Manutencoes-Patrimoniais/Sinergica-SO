---
name: "docs-adr-1008-observacao-reserva-equipment-md"
description: "Documento Sinérgica SO: ADR-1008 — Observações de reconciliação Equipment"
alwaysApply: false
---

# ADR-1008 — Observações de reconciliação Equipment

Status: preparação privada, não homologada.

Permitir ao responsável autorizado registrar observação sobre reserva pendente, com motivo, ator, Cliente e requestId, em histórico imutável. A observação é uma declaração humana: não confirma existência ou ausência no Auvo, não altera outbox, não libera reserva e não autoriza reenvio. Pedido repetido com mesmo ator e conteúdo retorna o mesmo recibo; divergência é recusada.

Gate e execução permanecem fechados. Validar minimização dos textos, escopo por Cliente, retenção, RLS/FORCE, revogação, concorrência e histórico antes de liberar. O procedimento efetivo de resolução com evidência confiável continua pendente.
