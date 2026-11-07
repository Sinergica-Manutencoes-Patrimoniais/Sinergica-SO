---
name: "docs-adr-0497-liberacao-conversao-reserva-md"
description: "Documento Sinérgica SO: ADR-0497 — liberação e conversão de reserva interna"
alwaysApply: false
---

# ADR-0497 — liberação e conversão de reserva interna

Status: proposto; não aplicado nem homologado. Uma reserva pode ser liberada com motivo ou convertida, sob autorização e revisão, para alocação ao lançamento existente pelo comando canônico. A conversão registra liberação e chama a alocação na mesma transação: falha reverte ambos. Não cria lançamento, documento fiscal ou cobrança externa. O evento é imutável e idempotente; o gatilho passa a impedir alocação apenas enquanto a reserva não estiver liberada.

Locks, interação com fechamento de competência, isolamento, concorrência com todos os escritores financeiros e semântica de estorno exigem testes e revisão adversarial. A mudança só está preparada, com gates/grants fechados; não comprova cobertura de todas as rotas financeiras.
