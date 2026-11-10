---
name: "docs-adr-0305-decisao-foto-levantamento-md"
description: "Documento Sinérgica SO: ADR-0305 — Decisão humana individual de foto"
alwaysApply: false
---

# ADR-0305 — Decisão humana individual de foto

Prepara-se registro imutável e versionado de decisão explícita `aceita` ou `rejeitada` para cada foto do levantamento, com motivo, autor e request id. Nova decisão preserva a anterior; a revisão esperada e bloqueio da foto evitam perda concorrente. A decisão é independente da linha e não publica, move, exclui ou torna a foto oficial.

Gate e execução permanecem fechados. A decisão não equivale a liberação de publicação e exige testes de permissões, histórico e concorrência antes da ativação.
