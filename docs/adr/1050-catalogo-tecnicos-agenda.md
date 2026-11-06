---
name: "docs-adr-1050-catalogo-tecnicos-agenda-md"
description: "Documento Sinérgica SO: ADR-1050 — Catálogo paginado para filtro de agenda"
alwaysApply: false
---

# ADR-1050 — Catálogo paginado para filtro de agenda

**Status:** preparação não homologada.

Consultar funcionários ativos permitidos pela RLS existente com busca literal por nome e paginação por nome/ID, sob a mesma capacidade e gates do filtro da agenda. A seleção não concede acesso ao funcionário, comprova qualificação ou disponibilidade; apenas fornece identificador para a consulta por técnico. Não assumir que o catálogo cobre todos os funcionários nem que todas as páginas formam uma fotografia única.

A função mantém `SECURITY INVOKER`, não concede acesso externo nesta etapa e não amplia políticas da tabela. Testar Unicode, collation, alterações concorrentes, cursores, desempenho, autorização/revogação, RLS real e revisão adversarial antes de habilitar; verificar rollout coordenado das duas consultas.
