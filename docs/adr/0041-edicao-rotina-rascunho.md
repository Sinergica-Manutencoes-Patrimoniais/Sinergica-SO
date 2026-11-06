---
name: "docs-adr-0041-edicao-rotina-rascunho-md"
description: "Documento Sinérgica SO: ADR-0041 — Edição de Rotina em rascunho"
alwaysApply: false
---

# ADR-0041 — Edição de Rotina em rascunho

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

Rotina pertencente à versão de rascunho pode ser editada pela capacidade `plano.gerir`, com revisão do Plano, autorização atual, `requestId` e auditoria antes/depois. Alvo tipado, Cliente, recorrência, instrução, referência a questionário e tolerâncias são validados transacionalmente; tolerância não informada equivale a zero. Tempo zero/ausente continua pendente. Questionário é referência ao cadastro existente, sem publicação ou chamada Auvo.

Esta etapa não aprova Plano nem congela questionário. Na aprovação futura será obrigatório preservar ID, versão e snapshot efetivo antes de ativar o fluxo; conteúdo aprovado não poderá ser editado por esta RPC. Não gerar Ocorrência/OS. Revisão adversarial, teste de concorrência e transições de versões continuam necessários antes de PASS.
