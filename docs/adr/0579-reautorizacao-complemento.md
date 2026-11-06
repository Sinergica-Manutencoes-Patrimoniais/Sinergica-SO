---
name: "docs-adr-0579-reautorizacao-complemento-md"
description: "Documento Sinérgica SO: ADR-0579 — nova autorização após revogação"
alwaysApply: false
---

# ADR-0579 — nova autorização após revogação

Status: proposto; gates fechados, não aplicado nem homologado. Uma nova autorização da mesma revisão é um novo registro imutável, sem restaurar ou apagar o anterior. O item é bloqueado antes de verificar se já há autorização ativa; a listagem e conferência selecionam somente autorização não revogada. O histórico mantém todos os eventos. Retentativas preservam requestId e autor.

A troca da restrição única por validação serializada exige auditoria de todos os escritores privilegiados, testes de concorrência com revogação/conferência e revisão de alçada e segregação antes de aplicar ou ativar. Autorização interna não é aceite do Cliente e não gera cobrança.
