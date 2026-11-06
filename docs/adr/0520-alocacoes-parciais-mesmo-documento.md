# ADR-0520 — parcelas distintas no mesmo documento

Status: alternativa proposta, não implementada nem homologada. A identidade da parcela permanece `sso_faturavel_alocacoes.id` e `request_id` únicos; repetir um pedido usa o contrato idempotente do comando proprietário. A unicidade histórica de item/documento continua vigente. Permitir parcelas distintas no mesmo documento depende de uma transição segura, ainda não implementada.

Uma futura substituição da restrição legada exigirá drenagem de transações, análise de concorrência com escritores privilegiados, ordem de locks, alterações de lançamento/estorno, regressão do legado e revisão financeira adversarial. Não cria lançamento, documento fiscal ou cobrança externa.

0745 é intencionalmente sem efeito: não altera a restrição histórica e não interrompe a sequência. Índice parcial não pode depender do valor mutável de um gate sem modelo adicional; a proposta anterior de trigger tomaria locks extras com gate fechado. Múltiplas parcelas no mesmo documento continuam pendentes até desenho, implementação e validação seguros.
