# ADR-1113 — Mediação do comando legado de orçamento

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar um mediador para o comando de orçamento operacional existente. Enquanto o gate de composição mista estiver fechado, o comportamento legado é preservado. Quando estiver aberto, o mediador exige prova privada, vinculada à transação e ao requestId, de que a chamada veio do comando misto; a prova é criada e removida na mesma transação. O núcleo legado renomeado permanece privado.

## Limites

Este controle cobre somente esse comando, não todos os escritores de propostas ou outros tipos de custo. Não ativar o gate até inventariar e migrar consumidores, tratar pedidos antigos, revisar privilégios do proprietário e FORCE RLS, testar transações, concorrência, rollback, replay e revisão adversarial. Não comprova unicidade física de gastos nem autoriza deploy.
