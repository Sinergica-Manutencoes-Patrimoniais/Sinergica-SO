# ADR-0246 — Reabertura auditada de rejeição de linha

## Decisão

Preparar reabertura explícita de rejeição com motivo, capacidade e revisão do lote. A rejeição vigente é movida integralmente para histórico privado append-only, com autoria/data/motivo originais e da reabertura, antes de ser retirada da projeção de rejeições vigentes; nada é apagado do histórico. A operação inicia novo ciclo de conferência do lote, preserva os registros anteriores e não reverte cadastros. Recusa o lote se alguma linha já tiver incorporação/vínculo.

## Limites

O modelo anterior guardava rejeição vigente como chave única; a migração acrescenta histórico e a exclusão da projeção ocorre apenas após cópia na mesma transação. Leitores legados de histórico precisam ser adaptados para combinar vigente e arquivo. Retentativa de rejeição antiga continua representando resultado histórico, não reativa rejeição. Gate fechado/RPCs revogadas; revisar segurança, locks e testes antes de ativar.
