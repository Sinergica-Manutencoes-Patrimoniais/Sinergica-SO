---
name: "docs-adr-0456-previa-conflitos-composicao-md"
description: "Documento Sinérgica SO: ADR-0456 — Prévia de seleção de Pendências"
alwaysApply: false
---

# ADR-0456 — Prévia de seleção de Pendências

Consulta autorizada e paginada em lote limitado verifica revisão, estado e vínculo ativo para até 100 Pendências selecionadas. Referências de outro Cliente ou inexistentes recebem retorno genérico indisponível. Trata-se de prévia não transacional: estado pode mudar após consulta, e o comando de composição continua responsável pela validação e bloqueios. Gate desligado, sem conceder RPC; testes e revisão de exposição pendentes.
