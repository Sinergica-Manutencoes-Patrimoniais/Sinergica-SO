---
name: "docs-adr-0695-mediacao-decisoes-codigos-md"
description: "Documento Sinérgica SO: ADR-0695 — Mediação de decisões e códigos em staging"
alwaysApply: false
---

# ADR-0695 — Mediação de decisões e códigos em staging

Consultas de decisão, código e reserva e comandos de reabertura ou correção são mediados sob o gate da ADR-0687. A autorização é verificada no Cliente do lote; os núcleos preservam permissões próprias adicionais, gates, locks, revisão e idempotência. Salvar e consultar código provisório exigem `cadastro.gerir`, sem acrescentar exigência de aprovação.

Mediadores não tornam códigos oficiais, não criam cadastros e não acionam Auvo. Ativação exige revisão de segurança e testes de isolamento, privilégios e concorrência.
