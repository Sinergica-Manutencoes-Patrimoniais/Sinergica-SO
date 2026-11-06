---
name: "docs-adr-1633-conflito-classificacao-legado-md"
description: "Documento Sinérgica SO: ADR 1633: conflito de classificação legada"
alwaysApply: false
---

# ADR 1633: conflito de classificação legada

Conflitos conhecidos de revisão ou fotografia na prévia e classificação usam `P0019`, deixando `40001` para serialização real. A confirmação de uma primeira tentativa rejeitada permite nova conferência; pedidos que já podem ter sido enviados preservam o mesmo identificador para replay. A autorização e a fotografia continuam verificadas no servidor, e o helper histórico mantém seu contrato.
