---
name: "docs-adr-0280-conferencia-alocacoes-competencia-md"
description: "Documento Sinérgica SO: ADR-0280 — Conferência de documentos por competência"
alwaysApply: false
---

# ADR-0280 — Conferência de documentos por competência

Status: proposta; gate fechado e validação pendente.

O Financeiro autorizado consulta associações entre documento existente e item faturável do Cliente, filtradas pela competência do item (não pela data do documento). A consulta lista alocações e estornos lógicos separadamente, sem apresentar totais da página como saldo definitivo, criar documento, lançar, cobrar ou inferir reconciliação. Paginação e valores em centavos preservam precisão. Gate, execução e interface permanecem desligados até revisão de autorização, isolamento e testes.
