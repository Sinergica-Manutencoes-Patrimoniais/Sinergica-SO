---
name: "docs-adr-0696-mediacao-localizacao-grupo-md"
description: "Documento Sinérgica SO: ADR-0696 — Mediação de Localização e retratos de Grupo"
alwaysApply: false
---

# ADR-0696 — Mediação de Localização e retratos de Grupo

A incorporação individual de Localização e as consultas de retrato de Localização e Grupo usam mediadores autenticados, com gate da ADR-0687 e `cadastro.aprovar` no Cliente. Núcleos preservam autorização, limites, revisão, idempotência e auditoria; permissões diretas não são concedidas. Listagem de lotes e linhas já é concedida a authenticated pela 0318, sem alteração nesta decisão.

Ativação depende de testes e revisão de segurança, isolamento, privilégios e efeitos de integração externa.
