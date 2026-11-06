---
name: "docs-adr-0557-cancelamento-saldo-faturavel-md"
description: "Documento Sinérgica SO: ADR-0557 — cancelamento de item com histórico ou reserva"
alwaysApply: false
---

# ADR-0557 — cancelamento de item com histórico ou reserva

Status: proposto; não aplicado nem homologado. A análise identificou que o comando 0343 cancela somente item pendente, mas não verifica competência fechada nem histórico inconsistente de alocação ou reserva interna. O wrapper, quando o gate financeiro está ativo, bloqueia cancelamento nessas condições, preserva retry do pedido já concluído e delega ao comando original. Gate financeiro desligado mantém o comportamento legado. Conferência não é alterada.

Estorno de parcela já usa centavos inteiros, identidade própria e saldo líquido; sua equivalência transacional e a coordenação com todas as rotas precisam de testes. A guarda não substitui reconciliação de dados inconsistentes. Nenhuma cobrança, aplicação ou efeito externo nesta etapa.
