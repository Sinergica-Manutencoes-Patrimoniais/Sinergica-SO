---
name: "docs-adr-1626-conflito-edicao-rotina-md"
description: "Documento Sinérgica SO: ADR 1626: conflito de revisão na edição de Rotina"
alwaysApply: false
---

# ADR 1626: conflito de revisão na edição de Rotina

Revisão divergente na edição de Rotina é conflito definitivo, não serialização transitória. O comando retorna P0011 apenas para essa condição, mantendo replay e erros reais do banco. A interface só descarta uma tentativa após rejeição definitiva na primeira chamada; pedidos incertos preservam o mesmo identificador.
