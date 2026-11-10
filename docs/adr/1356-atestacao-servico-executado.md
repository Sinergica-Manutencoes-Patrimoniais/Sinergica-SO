---
name: "docs-adr-1356-atestacao-servico-executado-md"
description: "Documento Sinérgica SO: ADR 1356 — Atestação PCM de execução de serviço"
alwaysApply: false
---

# ADR 1356 — Atestação PCM de execução de serviço

## Contexto

Uma identidade interna de serviço pode apontar para uma resposta com validação aprovada, mas essa associação por si só não é uma declaração explícita de que o serviço foi executado. Também não resolve a exclusividade financeira da origem.

## Decisão

Permitir que responsável com permissão de validação registre ou retire, com motivo, uma atestação explícita vinculada ao fato declarado e à revisão aprovada atual. A transição tem revisão esperada, request idempotente, auditoria e histórico imutável. Nova aprovação/revisão posterior torna a declaração anterior historicamente identificável, mas não automaticamente atual. A atestação é uma declaração humana, não certificação independente da execução física.

Não libera faturável, cobrança, recebível ou documento, e não declara exclusividade entre origens. O gate inicia fechado; consultas e comandos devem respeitar Cliente e permissão atual. Implementação e tela exigem testes de concorrência, permissão, revogação, replay, revisão PCM e revisão adversarial antes de abertura.
