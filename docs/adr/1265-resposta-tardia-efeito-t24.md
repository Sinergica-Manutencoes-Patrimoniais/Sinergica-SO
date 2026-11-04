# ADR-1265 — Observação tardia de efeito T−24

**Status:** proposta local, não homologada.

Quando criação ou atualização ultrapassar o prazo, preparar registro de resultado incerto e, se a promessa do transporte retornar posteriormente enquanto o runtime ainda existir, registrar a identidade observada no histórico tardio existente. Essa observação não confirma o efeito, não vincula tarefa e não autoriza reenvio. Falha de registro mantém reconciliação manual; runtime pode encerrar antes da resposta.

Antes de conexão operacional, validar contrato Auvo, resposta tardia antes/depois do registro incerto, fences, dupla resposta, cancelamento, persistência, limites e revisão adversarial. Não executar tarefas reais nesta etapa.
