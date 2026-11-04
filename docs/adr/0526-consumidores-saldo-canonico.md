# ADR-0526 — consumidores de saldo canônico

Status: proposto; não aplicado nem homologado. Seleção e emissão interna integral/parcial, consulta de saldo, alocação e estorno passam a usar o controlador 0749 para somas de alocações canônicas ativas. O controlador passa a `VOLATILE` para que uma chamada posterior a uma escrita na mesma transação possa observar seus efeitos, particularmente após inserir estorno. Não muda a unicidade legada nem introduz tabela paralela de parcelas.

Essa migração não conclui o inventário de todas as consultas e proteções de lançamento, nem demonstra equivalência de snapshots, isolamento e ordem de locks. A alteração de volatilidade, comportamento após estorno, concorrência e regressão financeira exigem testes e revisão adversarial antes de aplicação. Gates permanecem fechados.
