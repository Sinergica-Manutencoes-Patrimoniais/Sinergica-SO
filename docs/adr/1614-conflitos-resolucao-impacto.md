---
name: "docs-adr-1614-conflitos-resolucao-impacto-md"
description: "Documento Sinérgica SO: ADR 1614: conflitos definitivos de resolução de impacto"
alwaysApply: false
---

# ADR 1614: conflitos definitivos de resolução de impacto

Revisão e decisão divergentes nas APIs de resolução de retirada e sua consulta são conflitos de negócio. Códigos explícitos evitam retentativas do transporte para esses casos, preservando 40001 real. A interface só abandona pedido após resposta definitiva da primeira tentativa; pedidos incertos permanecem para replay.
