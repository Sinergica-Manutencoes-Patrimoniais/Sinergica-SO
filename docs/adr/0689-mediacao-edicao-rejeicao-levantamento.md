---
name: "docs-adr-0689-mediacao-edicao-rejeicao-levantamento-md"
description: "Documento Sinérgica SO: ADR-0689 — Mediação de edição e rejeição de linhas"
alwaysApply: false
---

# ADR-0689 — Mediação de edição e rejeição de linhas

Edição e rejeição de linhas usam mediadores autenticados sujeitos ao gate da ADR-0687 e à permissão `cadastro.aprovar` no Cliente real do lote. Os comandos internos permanecem revogados e mantêm validação, locks, revisão, idempotência e auditoria. O navegador não recebe credenciais privilegiadas.

A recepção manual existente já possui concessão a authenticated na migration 0320; esta decisão não revoga nem altera esse contrato legado. Ativação depende de testes, revisão de privilégios e segurança.
