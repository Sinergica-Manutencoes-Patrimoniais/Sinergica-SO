---
name: "docs-adr-1275-consulta-contratos-origem-campo-md"
description: "Documento Sinérgica SO: ADR-1275 — Consulta administrativa de contratos de origem"
alwaysApply: false
---

# ADR-1275 — Consulta administrativa de contratos de origem

Status: proposta local; não aplicada nem homologada.

Preparar listagem paginada dos contratos versionados para superadministrador ativo, com sessão, gate administrativo e serialização de revogação. O cadastro e alteração de estado reutilizam as funções auditadas, com controle explícito de request e estado esperado. A lista pode conter motivo e referência de evidência, que são declarações administrativas e não provam o comportamento Auvo.

Não abrir gates, conceder acesso operacional ou registrar informações sensíveis em mapeamentos. Antes de uso: validar permissão e revogação real, paginação concorrente, privacidade, idempotência e concorrência de habilitação com processamentos, RLS/FORCE, acessibilidade e revisão adversarial.
