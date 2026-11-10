---
name: "docs-adr-0230-atribuicao-parcela-os-md"
description: "Documento Sinérgica SO: ADR-0230 — Atribuição explícita de parcela a OS"
alwaysApply: false
---

# ADR-0230 — Atribuição explícita de parcela a OS

## Decisão

Preparar atribuição explícita e auditada de parcela pendente a OS existente do mesmo Chamado/Cliente, com revisões do Chamado e escopo e comparação do estado e `updated_at` da OS sob lock. Uma parcela pode ter apenas uma atribuição nesta etapa conservadora. Retry idêntico devolve o resultado, sem criar OS, chamar Auvo ou afirmar execução/interrupção.

## Limites

Associação não comprova que a tarefa Auvo contenha aquela parcela, nem que foi iniciada ou concluída. Escritores legados e despacho ainda não são obrigados a respeitar essa relação; falta ciclo de realocação/continuação, captura confiável em campo, revisão de concorrência e política de suspensão. Gate fechado, RPC revogada; sem teste/aplicação.
