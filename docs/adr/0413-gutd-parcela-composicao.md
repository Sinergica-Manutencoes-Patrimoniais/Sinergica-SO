---
name: "docs-adr-0413-gutd-parcela-composicao-md"
description: "Documento Sinérgica SO: ADR-0413 — Estado GUTD da composição por parcela"
alwaysApply: false
---

# ADR-0413 — Estado GUTD da composição por parcela

Parcela não possui GUTD próprio no modelo existente. A consulta privada mostra os fatores e pontuação da composição vinculada, identificando ausência de fatores/pesos sem atribuir prioridade individual nem posição fixa na fila. Dor ausente usa redistribuição existente entre G/U/T; sem pesos G/U/T a pontuação é desconhecida.

Gate e execução fechados. Ranking global, integridade do vínculo, coerência de pesos e testes devem ser validados antes de ativar.
