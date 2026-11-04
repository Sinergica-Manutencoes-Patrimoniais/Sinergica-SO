# ADR-0573 — Atualização explícita de cadastros em lote

Status: proposta; gate fechado, não homologada.

O PCM seleciona até 50 linhas de Sistema ou Equipamento/Componente, cada uma com destino, snapshot, motivo e requestId próprios. A operação usa exclusivamente os comandos 0756 e 0767, exige revisão inicial e encadeia as revisões retornadas. Cada comando verifica aprovação, conferência, cliente e snapshot e inibe a sincronização Auvo durante a atualização. Não há criação de cadastro.

A transação é integral: qualquer falha reverte todos os itens, sem resultados parciais. O resultado identifica cada item; retry com o requestId e payload originais recupera a resposta. Chamadas, tabela e gate permanecem fechados. Antes de habilitar, revisar concorrência, idempotência e triggers, testar rollback e confirmar que todos os caminhos Auvo são efetivamente suprimidos. UI e seleção humana ainda não integradas.
