---
name: "docs-adr-0402-historico-impedimento-suspensao-md"
description: "Documento Sinérgica SO: ADR-0402 — Impedimento no histórico de suspensão"
alwaysApply: false
---

# ADR-0402 — Impedimento no histórico de suspensão

Prepara-se projeção privada do impedimento de um evento já listado no histórico paginado, autorizada pelo Cliente do Chamado. Eventos anteriores ou retomadas podem não ter impedimento; ausência é explicitada, sem inventar evidência ou motivo.

Gate e execução permanecem fechados. Revisão de autorização e testes de paginação/invalidação antecedem ativação.
