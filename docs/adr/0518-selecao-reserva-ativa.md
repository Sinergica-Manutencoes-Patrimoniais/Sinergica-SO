---
name: "docs-adr-0518-selecao-reserva-ativa-md"
description: "Documento Sinérgica SO: ADR-0518 — seleção com reserva existente"
alwaysApply: false
---

# ADR-0518 — seleção com reserva existente

Status: proposto; gates fechados, não aplicado nem homologado. A seleção de novo documento rejeita item que já possua reserva ativa, sob o mesmo lock do item; retentativa de seleção já registrada continua idempotente. Isso evita apresentar o saldo não reservado como elegível a outra intenção. O AC-4 exige parcelas e distribuição explícita, mas não exige agrupar múltiplos candidatos no mesmo documento; nenhuma regra de agrupamento foi inferida.

A regra suporta apenas uma reserva ativa por item e não comprova a integridade de todas as rotas de alteração/estorno. Múltiplas parcelas associadas ao mesmo documento financeiro ainda precisam de revisão da unicidade existente e do contrato de identidade. Revisão adversarial e testes de concorrência continuam obrigatórios; nenhum envio ou cobrança.
