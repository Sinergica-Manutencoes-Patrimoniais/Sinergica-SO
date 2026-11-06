---
name: "docs-adr-0458-alcada-paginacao-avaliacao-os-md"
description: "Documento Sinérgica SO: ADR-0458 — capacidade e paginação das avaliações"
alwaysApply: false
---

# ADR-0458 — capacidade e paginação das avaliações

Status: proposto; gates fechados, sem aplicação ou homologação. A alçada usa a capacidade existente `integracao.reconciliar` no Cliente, sem exigir papel fixo de superadmin. Permanece proibida a avaliação pelo autor da declaração e exige-se autorização atual. A consulta paginada usa revisão decrescente com limite, preservando escopo e sem alterar efeitos. A configuração efetiva de capacidades e a adequação da segregação devem passar por revisão antes de ativar; não se infere aprovação de negócio. Nenhum retry ou consulta Auvo é autorizado.
