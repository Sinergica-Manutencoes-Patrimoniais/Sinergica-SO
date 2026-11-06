---
name: "docs-adr-0700-mediacao-quarentena-csv-md"
description: "Documento Sinérgica SO: ADR-0700 — Mediação de quarentena CSV"
alwaysApply: false
---

# ADR-0700 — Mediação de quarentena CSV

Recepção, listagem, correção, histórico, validação e reconciliação da quarentena usam mediadores autenticados, sujeitos ao gate da ADR-0687 e a `cadastro.gerir` no Cliente informado ou no Cliente real da quarentena. Os núcleos permanecem privados e mantêm seus gates, validações, autorização, auditoria e idempotência. A reconciliação gera apenas staging, sem gravar cadastro oficial.

Ativação depende de revisão de segurança e testes de isolamento, paginação, repetição, conteúdo e concorrência.
