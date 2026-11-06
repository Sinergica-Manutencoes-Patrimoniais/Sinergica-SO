# ADR-0576 — histórico comercial da autorização

Status: proposto; gates fechados, não aplicado nem homologado. A consulta paginada apresenta autorizações e revogações de um complemento no escopo Cliente/proposta e exige capacidade comercial. A interface permite revogar somente autorização da revisão corrente, com motivo e pedido idempotente; 0804 prepara nova autorização após revogação para a mesma revisão, preservando o histórico. Decisão interna não é aceite do Cliente e não modifica cobrança. Permissões, concorrência e recuperação exigem testes antes da ativação.
