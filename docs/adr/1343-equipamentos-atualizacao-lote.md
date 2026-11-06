---
name: "docs-adr-1343-equipamentos-atualizacao-lote-md"
description: "Documento Sinérgica SO: ADR-1343 — Equipamentos na atualização selecionada em lote"
alwaysApply: false
---

# ADR-1343 — Equipamentos na atualização selecionada em lote

**Estado:** proposta; não aplicada nem homologada.

## Contexto

O comando individual de campos atende Equipamentos e Componentes, mas o lote aceita somente o rótulo `componente`; a interface enviava esse rótulo mesmo para uma linha de Equipamento. Isso esconde a classificação real no recibo e na confirmação.

## Decisão

Aceitar `equipamento` como tipo explícito no lote e encaminhá-lo ao mesmo comando individual já utilizado, que verifica o tipo real do cadastro. O servidor confere a classificação na linha e na fotografia, mantendo compatibilidade com o rótulo antigo de Equipamento. Preservar o protocolo antigo e seus recibos; não renomear cadastros, códigos ou tipos. A interface identifica o tipo mostrado na fotografia e confere os recibos individuais antes de limpar o pedido.

## Limites

Migration deve falhar se as definições esperadas diferirem. Testar atualização mista, replay de pedido antigo, classificação divergente, código, autorização, concorrência e rollback antes de liberar. Os gates existentes permanecem fechados e não há envio Auvo.
