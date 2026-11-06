# ADR-1630 — Autorização serializada da fila de Grupo

A conferência de acesso da fila de Grupo validava a concessão antes de adquirir a trava compartilhada usada pelo protocolo de revogação. Uma revogação podia confirmar nesse intervalo; em particular, o replay da reabertura retornava o recibo sem uma segunda conferência.

A trava passa a ser adquirida antes da leitura da autorização, mantendo READ COMMITTED, a autorização por Cliente, as assinaturas, as ACLs e os gates existentes. Se uma revogação estiver em andamento, a operação retorna `55P03` (`autorizacao_em_alteracao`); se for anterior, impede a revogação até o fim da transação. A alteração não habilita nenhuma funcionalidade nem autoriza efeitos no Auvo.
