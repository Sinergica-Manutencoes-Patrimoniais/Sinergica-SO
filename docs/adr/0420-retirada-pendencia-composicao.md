---
name: "docs-adr-0420-retirada-pendencia-composicao-md"
description: "Documento Sinérgica SO: ADR-0420 — Retirada de Pendência não vinculada à parcela"
alwaysApply: false
---

# ADR-0420 — Retirada de Pendência não vinculada à parcela

Prepara-se retirada explícita de Pendência da composição somente enquanto não houver vínculo a parcela, com motivo, revisão da composição, controle de concorrência e evento imutável contendo vínculo anterior. A Pendência e o Chamado não são alterados. A projeção ativa de associação é removida para permitir nova composição; o histórico auditável preserva a relação anterior.

Uma composição pode ficar vazia e não é apagada automaticamente. Gate e execução fechados; testes de concorrência com atribuição, consumidores de composição vazia e revisão adversarial são necessários antes de ativar.
