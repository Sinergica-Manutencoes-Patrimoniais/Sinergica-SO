---
name: "docs-adr-1609-escolhas-data-conflitos-sem-retry-md"
description: "Documento Sinérgica SO: ADR 1609 — Conflitos nas escolhas de nova data"
alwaysApply: false
---

# ADR 1609 — Conflitos nas escolhas de nova data

Status: aceito para implementação; homologação pendente.

Guardas explícitas de revisão, decisão e data candidata nas prévias, consultas e escolha de Visita passam a retornar `P0011` ou `P0014` em vez de `40001`, evitando retry transacional sem fim. A decisão comparada chamada pelas duas escolhas já usa `P0010` e `P0011` para fotografia e revisão. As telas só liberam nova tentativa após rejeição definitiva da primeira tentativa; replay incerto permanece preservado. Triggers e demais conflitos não mencionados permanecem fora deste recorte. Erros reais de serialização não são convertidos.
