---
name: "docs-adr-0719-mediacao-vinculo-foto-ativo-md"
description: "Documento Sinérgica SO: ADR 0719 — Mediação de vínculo de foto a ativo"
alwaysApply: false
---

# ADR 0719 — Mediação de vínculo de foto a ativo

## Decisão

Consultas e comandos de vínculo temporário de foto a Sistema ou Componente passam por funções mediadoras autenticadas. Antes de chamar o núcleo existente, a mediação obtém o Cliente da foto e exige as capacidades `cadastro.aprovar` e `cadastro.gerir`; referência inexistente ou não autorizada recebe a mesma resposta. O núcleo mantém a verificação de gate, revisão, origem, locks, idempotência e auditoria, assim como os gatilhos de inadequação e retirada.

As funções internas e tabelas seguem sem concessão direta ao navegador. A decisão não adiciona Equipamentos nem publicação automática. Os gates permanecem fechados; testes, revisão de segurança e aplicação ordenada são necessários antes do uso.
