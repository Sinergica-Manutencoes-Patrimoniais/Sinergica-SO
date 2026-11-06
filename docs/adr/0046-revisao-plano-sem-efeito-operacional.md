---
name: "docs-adr-0046-revisao-plano-sem-efeito-operacional-md"
description: "Documento Sinérgica SO: ADR-0046 — Submissão e devolução de Plano para revisão"
alwaysApply: false
---

# ADR-0046 — Submissão e devolução de Plano para revisão

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

O gestor com concessão atual `plano.gerir` pode submeter rascunho para revisão e devolvê-lo a rascunho. Ambas as transições usam a revisão do Plano, requestId idempotente e auditoria na mesma transação. Em revisão, os comandos de edição de rascunho permanecem bloqueados. Submissão não constitui aprovação, não congela conteúdo e não cria ocorrências ou ações externas. A validação completa, aprovação com vigência e snapshots são implementações posteriores, sem exposição de aprovação até que sejam verificadas. Devolução preserva as Rotinas e não apaga histórico.

O bloqueio de linha do Plano serializa a transição com os comandos existentes de edição. A autorização é reavaliada também em repetição, e repetir um requestId com payload diferente é conflito. A revisão adversarial e o teste concorrente real seguem obrigatórios antes de PASS.
