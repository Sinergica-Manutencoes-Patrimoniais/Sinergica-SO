---
name: "docs-adr-0698-mediacao-listagens-conferencia-md"
description: "Documento Sinérgica SO: ADR-0698 — Mediação das listagens de conferência"
alwaysApply: false
---

# ADR-0698 — Mediação das listagens de conferência

Classificação de linhas, códigos e linhas editadas é mediada por funções autenticadas com gate da ADR-0687 e `cadastro.aprovar` no Cliente do lote. Núcleos permanecem privados e preservam validação, paginação, filtros e escopo originais. Anotação e histórico de conferência já possuem concessão a authenticated desde a 0327 e não são alterados.

O gate segue desligado até testes e revisão de segurança, privilégios, paginação e isolamento.
