---
name: "docs-adr-1516-identidade-ocorrencia-comparada-md"
description: "Documento Sinérgica SO: ADR-1516 — Comparar identidade operacional ao decidir impacto"
alwaysApply: false
---

# ADR-1516 — Comparar identidade operacional ao decidir impacto

## Contexto
O PCM seleciona uma ocorrência por ciclo ou por Visita e semana, mas a fotografia da ADR-1514 só incluía alvo e vencimento. Uma alteração na identidade operacional poderia não invalidar a decisão conferida.

## Decisão
A comparação versionada inclui índice do ciclo de calendário ou ID e semana de Visita. A interface mostra esses dados e o comando transacional compara a resposta completa atualizada. Pedidos já confirmados continuam repetíveis com a fotografia original; pedido pendente ainda não gravado com fotografia anterior é recusado como obsoleto e exige nova conferência.

## Consequências
Mudança parcial e aditiva: o endpoint de comparação anterior continua disponível para leitores legados, mas não autoriza novos comandos sob a comparação reforçada. Migration e interface devem ser atualizadas juntas; gates, guarda 1045 e bloqueio de aprovação permanecem. A fotografia não comprova integralidade de fontes ou conteúdo de questionários.
