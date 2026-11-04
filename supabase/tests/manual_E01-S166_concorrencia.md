# Concorrência S166/PMOC (banco descartável isolado)

Use um banco isolado e descartável com migrations até 1645 aplicadas. Execute `setup` em transação e confirme somente nesse banco. Todas as demais sessões são independentes; as sessões A dormem 20 s para manter a transação aberta. Não executar em ambiente compartilhado ou com conexões externas.

1. Inicie `sessao_a` e aguarde a resposta da materialização; execute `sessao_b` antes do commit. Após A concluir, execute `sessao_b_retry`. Resultado esperado: bloqueio 55P03, depois reuso, uma ocorrência.
2. Inicie `fonte_a`; confirme que está em `PgSleep` e execute `fonte_b`. Após A concluir, execute `fonte_b_retry`. Resultado esperado: trava 55P03 durante alteração e reconciliação após confirmação.
3. Restaure o status do agendamento sintético para `agendado`; inicie `geracao_a`, aguarde a resposta e execute `geracao_b` durante a espera. Resultado esperado: timeout de trava na atualização PMOC.
4. Descarte o banco. Não enviar tarefas, executar cron ou conectar integrações externas. Este ensaio não cobre revisão/aprovação, Visita, múltiplos Planos nem todos os escritores legados.
