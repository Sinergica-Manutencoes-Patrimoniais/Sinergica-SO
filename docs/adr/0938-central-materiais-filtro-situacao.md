---
name: "docs-adr-0938-central-materiais-filtro-situacao-md"
description: "Documento Sinérgica SO: ADR-0938 — Filtro paginado por situação na Central de Materiais"
alwaysApply: false
---

# ADR-0938 — Filtro paginado por situação na Central de Materiais

**Status:** proposto, não homologado.

A Central filtra situação somente entre páginas carregadas; isso não representa o conjunto do Cliente. Acrescentar consulta mediada separada que aplica Cliente, OS, responsável e situação antes da paginação por ID. Preservar a RPC existente para clientes antigos e selecionar a nova por flag desligada por padrão.

A nova consulta deve manter gate da Central fechado, autorização `material.gerir` por Cliente, isolamento read committed e serialização com alterações de autorização. Não cria listas nem altera dados. Paginação não é snapshot entre requisições: alterações concorrentes podem deslocar resultados. Antes de ativar: pgTAP/RLS, revogação e concorrência, ordenação entre páginas, dados legados, desempenho/índices e revisão adversarial. Não aplicar em produção nesta etapa.
