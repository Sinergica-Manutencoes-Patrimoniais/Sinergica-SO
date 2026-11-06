# ADR-1426 — Itens atuais da proposta por Cliente

Complementa ADR-1425 com leitura paginada da composição atual, mantendo acesso direto às tabelas restrito. A consulta reaproveita a verificação de Cliente e `custo.ler`, retorna apenas campos explícitos dos itens e não inclui snapshots ou documentos. A página é ordenada por UUID; não constitui fotografia transacional entre chamadas. A edição e o histórico continuam fora desta entrada.

Não ativar antes de verificar autorização, isolamento, paginação concorrente, revogação, precisão, RLS/FORCE e revisão adversarial. Gate de ADR-1425 continua fechado.
