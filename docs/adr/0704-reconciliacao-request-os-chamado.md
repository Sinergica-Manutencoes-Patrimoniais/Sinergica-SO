# ADR-0704 — Reconciliação de pedido de OS por identidade

Status: preparada; não aplicada nem homologada.

O fluxo legado procura uma única OS pelo Chamado e não pode reconciliar com segurança uma tentativa específica quando houver várias. O comando S167 já conserva, transacionalmente, ator, Cliente, Chamado, payload e resultado por `request_id` em `pcm.chamado_os_comandos`.

Adicionamos uma consulta privada, sob gate próprio desligado, que exige autorização atual `chamado.os.criar`, mesmo Cliente, mesmo Chamado e o mesmo ator registrado. Ela devolve somente o resultado do comando correspondente após conferir o payload integral e as identidades do resultado. A ausência é indeterminada: uma transação pode estar pendente ou o pedido pode não ter sido registrado; não autoriza criar outra OS nem seleciona uma OS arbitrária. Idempotência permanece responsabilidade do comando original com o mesmo payload.

O gate, restrições e escritores legados permanecem inalterados. Não há concessão automática de execução, alteração de dados, numeração, OS ou envio externo. Antes de uso são necessários testes de isolamento, revogação, concorrência e revisão adversarial, além de adaptar os consumidores com tratamento explícito de resultado indeterminado.
