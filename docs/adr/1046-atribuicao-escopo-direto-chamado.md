# ADR-1046 — Atribuição de parcela direta do Chamado

**Status:** preparação privada, não homologada.

Parcelas próprias do Chamado, sem origem ou ciclo de Backlog, podem ser vinculadas a uma OS não terminal do mesmo Chamado e Cliente. Reusar `sso_atribuicoes_parcela`, sua identidade por parcela e auditoria; não criar OS, marcar atendimento ou enviar tarefa. A consulta fornece revisões do Chamado/composição e estado/data da OS; o comando relê e bloqueia esses registros, verifica autorização, revisão e pedido idempotente e recusa vínculo preexistente.

Este caminho recusa parcelas que tenham vínculo ou ciclo de Backlog; elas continuam nos comandos próprios, que conferem suas regras e histórico. Não deduzir ausência de outros caminhos de origem sem revisão. Usar gate novo desligado, além do gate existente, funções privadas e flag de interface desligada. A consulta paginada não representa snapshot entre requisições.

Antes de liberar: inventariar outros vínculos e escritores de parcela, política de correção e continuidade, ordens de lock, concorrência entre caminhos e atribuições diferentes, RLS, sessão, revogação, replay, isolamento Cliente e revisão adversarial. Integrar ao modelo completo de escopo/OS e testar com múltiplas OS antes de concluir AC-1. Nenhum envio Auvo ou deploy autorizado.
