---
name: "docs-adr-0222-suspensao-canonica-chamado-md"
description: "Documento Sinérgica SO: ADR-0222 — Declaração canônica de suspensão de Chamado"
alwaysApply: false
---

# ADR-0222 — Declaração canônica de suspensão de Chamado

## Decisão

Preparar agregado aditivo e versionado que registra suspensão e retomada explícitas do Chamado com motivo, ator, Cliente, revisão otimista e auditoria. Ausência de registro significa estado não informado, não ativo presumido. A transação valida capacidade atual de gestão de escopo e revisão do Chamado legado; não altera seu status nem interrompe automaticamente OS ou Auvo.

## Limites

Suspensão administrativa isolada não prova ausência de execução em andamento ou torna parcelas aptas a devolução. A capacidade adequada e compatibilidade com demais escritores/processadores exigem revisão. Gate desligado e RPCs revogadas; não aplicar/ativar antes de testes concorrentes e revisão adversarial.
