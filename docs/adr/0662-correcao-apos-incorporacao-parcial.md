# ADR-0662 — Correção de linha não incorporada após aprovação parcial

Status: proposta; gate fechado, não homologada.

O PCM pode corrigir uma linha ainda não incorporada nem atualizada, com retrato, revisão, motivo e auditoria. A operação bloqueia linhas já efetivadas e linhas referenciadas por itens já incorporados ou atualizados. Ela abre novo ciclo de conferência, invalidando aprovações ainda não executadas; não altera nem reverte cadastros já oficiais. A exceção à guarda legada é limitada à transação e à linha autorizada, sem liberar comandos antigos.

Gate/RPC fechados. Revisar reabertura, dependências transitivas, rollback, concorrência e histórico antes de aplicar. Não executada nesta etapa.
