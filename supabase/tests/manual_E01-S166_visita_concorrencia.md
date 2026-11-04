# Concorrência de Visita/PMOC (banco descartável)

Em banco isolado descartável, aplique migrations até 1645 e execute `setup` numa transação confirmada. Sessões A mantêm a transação aberta por 20 s.

1. Execute `concorrencia_a`; após retorno da preparação, rode `concorrencia_b` durante a espera e `concorrencia_b_retry` depois do commit.
2. Execute `fonte_a`; após confirmar `PgSleep`, rode `fonte_b` e, após commit, `fonte_b_retry`.
3. Restaure o PMOC sintético para `agendado`; execute `geracao_a` e, após retorno da preparação, `geracao_b` durante a espera.
4. Descarte o banco. Não executar cron, integrações nem tarefas Auvo. Escopo: uma Visita, uma classificação, sem aprovação, lote ou múltiplos Planos.
