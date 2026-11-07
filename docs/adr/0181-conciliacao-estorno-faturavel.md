---
name: "docs-adr-0181-conciliacao-estorno-faturavel-md"
description: "Documento Sinérgica SO: ADR-0181 — Conferência de contrapartida financeira do estorno"
alwaysApply: false
---

# ADR-0181 — Conferência de contrapartida financeira do estorno

**Estado:** preparação bloqueada; não homologada nem implantada.

O estorno lógico de S182 não é, sozinho, estorno contábil. Financeiro pode registrar uma conferência explícita entre esse estorno e um lançamento de saída já realizado, da mesma Conta e valor, com referência e motivo; ambos os registros são travados durante a vinculação, e cada saída só pode ser associada uma vez. As competências do item e da contrapartida devem estar abertas. A conferência guarda autor, data, identidade do pedido e auditoria, sem alterar lançamento, pagamento, cobrança ou documento.

O vínculo prova apenas que um operador declarou e conferiu a correspondência; valor e Cliente iguais não demonstram por si que a saída representa a devolução correta. Identidade/legitimidade da contrapartida, consistência contábil, múltiplas parcelas, integrações legadas, correção/cancelamento posterior, revogação, concorrência e eventuais estornos com outras formas de prova precisam de revisão. Nenhum status é promovido automaticamente a estorno financeiro concluído. Gate de faturamento e RPCs fechados até testes e revisão adversarial.
