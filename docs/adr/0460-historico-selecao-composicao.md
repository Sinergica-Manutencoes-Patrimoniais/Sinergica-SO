---
name: "docs-adr-0460-historico-selecao-composicao-md"
description: "Documento Sinérgica SO: ADR-0460 — Histórico da seleção para composição"
alwaysApply: false
---

# ADR-0460 — Histórico da seleção para composição

Consultar somente leitura o comando original registrado na criação da composição, incluindo IDs e revisões das Pendências, ator e referência de solicitação. A fonte registra a seleção original, não necessariamente a associação atual, e não permite reconstruir seleções abandonadas antes do envio. Exigir autorização por Cliente, manter gate desligado e não conceder acesso direto; revisão e testes antes da liberação.
