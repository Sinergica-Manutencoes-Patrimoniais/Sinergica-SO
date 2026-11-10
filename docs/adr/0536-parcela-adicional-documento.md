---
name: "docs-adr-0536-parcela-adicional-documento-md"
description: "Documento Sinérgica SO: ADR-0536 — comando de parcela adicional"
alwaysApply: false
---

# ADR-0536 — comando de parcela adicional

Status: proposto; não aplicado nem homologado. O comando recebe identidade própria de parcela, revisão do item, documento canônico existente e valor; valida Cliente, autorização, gate e existência de alocação anterior no mesmo par. Identidade do lançamento, referência e data vêm do documento oficial, não de entrada livre. Após locks, delega ao comando de alocação canônico, que verifica saldo líquido e idempotência. Não cria lançamento, emissão fiscal, cobrança ou envio externo.

Ativação depende da transição 0757, testes de concorrência/reentrega/estorno e revisão financeira adversarial. A verificação de existência não comprova viabilidade futura; a transação revalida antes de escrever. Gates/grants continuam fechados.
