---
name: "docs-adr-1138-conferencia-codigos-por-revisao-md"
description: "Documento Sinérgica SO: ADR-1138 — Conferência de códigos por revisão do lote"
alwaysApply: false
---

# ADR-1138 — Conferência de códigos por revisão do lote

Status: proposta local, gate fechado; não aplicada nem homologada.

A consulta opcional de códigos exige ator e Cliente esperados e a revisão do lote; verifica autorização atual, trava o lote e reutiliza a mediação e o diagnóstico existentes. Cada página identifica a revisão conferida. Uma mudança da revisão exige nova consulta, sem aprovar, reservar ou alterar código.

O diagnóstico continua parcial: cadastros e aliases podem mudar sem alterar a revisão do lote, e páginas separadas não formam fotografia transacional. Validar escritores de linhas e códigos, locks, concorrência, paginação e collation, revogação, RLS/FORCE e revisão adversarial antes de habilitar. Não usar a consulta para provar ausência global de colisões.
