---
name: "docs-adr-0693-mediacao-historico-levantamento-md"
description: "Documento Sinérgica SO: ADR-0693 — Mediação de históricos de levantamento"
alwaysApply: false
---

# ADR-0693 — Mediação de históricos de levantamento

Os históricos de edição, rejeição e conferência de campos passam por funções mediadoras autenticadas. Exigem gate da ADR-0687 e permissão `cadastro.aprovar` para o Cliente do lote; funções internas mantêm suas validações e paginação e não são expostas diretamente. Não alteram dados.

O gate permanece desligado até revisão de segurança e testes de isolamento, paginação e privilégios.
