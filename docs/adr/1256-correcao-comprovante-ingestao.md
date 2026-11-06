# ADR-1256 — Correção de despesa com comprovante mediado

**Status:** proposta local, não homologada.

Preparar comando separado de correção usando reserva e confirmação de ingestão vinculadas ao mesmo ator, Cliente, despesa, request e objeto. A correção mantém histórico financeiro e verificações do comando existente; não altera policies compartilhadas do Storage. Gate específico nasce fechado. Comprovante precisa ter bytes conferidos pela fronteira de ingestão, não pelo SQL.

Antes de habilitar, integrar leitura de comprovantes de correção ao caminho com digest, interface e recuperação; validar isolamento, autorização/revogação, reenvio, locks, rollback, bytes e Storage/Edge reais, além de revisão adversarial. Caminhos legados continuam independentes; não habilitar deploy nem faturamento real.
