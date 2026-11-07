---
name: "docs-adr-0175-alocacao-faturavel-documento-existente-md"
description: "Documento Sinérgica SO: ADR-0175 — Alocação de faturável a documento financeiro existente"
alwaysApply: false
---

# ADR-0175 — Alocação de faturável a documento financeiro existente

**Estado:** preparação bloqueada, não homologada nem implantada.

Faturamento operacional exige item conferido, documento identificado e lançamento de entrada Financeiro existente da mesma Conta e competência. Não se cria lançamento, documento fiscal, cobrança, recebível ou pagamento neste comando. O documento vincula um único lançamento; alocação explícita tem identidade própria e preserva seu valor, autor e data. O somatório por item não supera seu valor conferido; somatório por documento não supera o lançamento, com locks e pedido idempotente. Competência fechada é recusada. Estado passa a parcial ou faturado, mantendo valor original.

Gate privado inicia desligado e funções não têm grant para aplicação. Antes de habilitar: revisar identidade do documento entre diferentes lançamentos e histórico legado, concorrência de competência e saldo, correspondência entre documento e lançamento, conciliação financeira, estornos, alterações posteriores do lançamento, cancelamento, devoluções, integração de cobrança e políticas de segurança. Sem estorno/conciliação e proteção contra alterações legadas, a alocação não constitui homologação financeira. A operação é preparada para ambiente de teste, nunca executada em dados reais nesta etapa.
