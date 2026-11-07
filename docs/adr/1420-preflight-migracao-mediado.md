---
name: "docs-adr-1420-preflight-migracao-mediado-md"
description: "Documento Sinérgica SO: ADR-1420 — Pré-conferência mediada de migração"
alwaysApply: false
---

# ADR-1420 — Pré-conferência mediada de migração

## Decisão

Disponibilizar, sob gate fechado e com ator, Cliente e autorização conferidos, as quatro leituras privadas de diagnóstico, referências, códigos e Planos legados. A prévia passa a sinalizar para revisão Planos com nenhum ou mais de um alvo; não escolhe um alvo por inferência. Nenhuma origem é alterada.

## Limites

Migration e tela não aplicadas nem testadas. Validar os quatro contratos, autorização/revogação, paginação concorrente, planos inconsistentes, exposição de dados, RLS/FORCE, volume e revisão adversarial. Prévia não é aceite, fotografia transacional ou migração.
