---
name: "docs-adr-0435-ranking-backlog-paginacao-consistente-md"
description: "Documento Sinérgica SO: ADR-0435 — Ranking de composições com dados incompletos"
alwaysApply: false
---

# ADR-0435 — Ranking de composições com dados incompletos

Consulta alternativa, somente leitura e gate desligado, exige G, U, T e D e pesos válidos para calcular score. Fator ausente não é estimado nem normalizado. Resultados sem score ficam em grupo separado, ordenado por identificador, sem prioridade inferida. Cursor inclui score, ID e assinatura da lista e dos pesos; alteração durante paginação invalida a continuação e exige reinício. Esta consulta não altera a priorização existente nem classifica parcelas. O custo da assinatura sobre todo o Cliente exige revisão de desempenho antes de ativar. Testes, autorização de exposição e homologação pendentes.
