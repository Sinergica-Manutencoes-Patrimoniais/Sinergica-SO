---
name: "docs-adr-0563-correcao-quarentena-csv-md"
description: "Documento Sinérgica SO: ADR-0563 — Consulta e correção da quarentena"
alwaysApply: false
---

# ADR-0563 — Consulta e correção da quarentena

Lotes privados de quarentena são consultados por Cliente; registros originais permanecem imutáveis. Correções são novas revisões auditadas, com células e diagnósticos declarados, autor e motivo, sem criar staging tipado ou cadastro oficial. A revisão do lote é comparada e serializada; divergências falham. Diagnósticos não são validação server-side e reenvio tipado exige fluxo próprio. Gates fechados; retenção, testes, revisão de segurança e integração de reenvio pendentes.
