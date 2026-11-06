---
name: "docs-adr-1044-promocao-continuidade-atomica-md"
description: "Documento Sinérgica SO: ADR-1044 — Promoção e registro de continuidade na mesma transação"
alwaysApply: false
---

# ADR-1044 — Promoção e registro de continuidade na mesma transação

**Status:** preparação privada, não homologada.

A promoção de retorno parcial e o registro da proposta como devolvida são complementares: se a segunda operação falhar, a primeira não deve ficar confirmada por este caminho. Criar uma entrada privada que recebe as duas identidades de pedido, revisão do retorno e revisão do Chamado anterior conferidas pelo operador, motivo e identidades do novo Chamado, parcela e ciclo. A entrada chama, na mesma transação PostgreSQL, os comandos existentes de promoção e registro, sem contornar seus gates, validações, locks, auditoria ou idempotência. Se qualquer chamada ou conferência do recibo falhar, toda a transação é revertida.

Os dois pedidos devem ser distintos e preservados em caso de resultado incerto. O recibo identifica ambas as ações e não comprova execução ou parada remota, não altera diretamente a parcela anterior nem cria OS ou tarefa. A entrada não recebe EXECUTE externo e não abre gates. A promoção separada preexistente não é removida nesta etapa; portanto não se afirma exclusividade global ou cobertura de todos os escritores. O fluxo continua bloqueado até integrar a interface, reconciliar os demais caminhos e completar a implementação e revisão da devolução de escopo.

Antes de liberar: testar rollback da segunda chamada, repetições idênticas e divergentes, disputa entre as duas entradas e escritores legados, revisões concorrentes, revogação e ordenação global de locks; conferir identidade e procedência de cada retorno, isolamento, RLS, permissões, auditoria e revisão adversarial. Não fazer deploy nem criar tarefa Auvo.
