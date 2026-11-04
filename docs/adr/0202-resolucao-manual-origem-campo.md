# ADR-0202 — Resolução manual conservadora para OS existente

## Decisão

Preparar resolução manual de envelope já triado apenas para OS existente do Cliente indicado, com `auvo_task_id` igual ao ID do envelope Auvo, confirmação de revisão, motivo, autorização global e no Cliente e locks do envelope/triagem/OS. Registrar resolução e auditoria sem criar OS, enviar ao Auvo ou aplicar evento. Permissão de trigger é interna à transação e limitada ao envelope para permitir apenas este comando passar pela guarda de 0426.

## Limites

O ID externo compatível não prova autenticidade do envelope. Fonte ainda não está conectada, todos os processadores e concorrência precisam ser auditados, e processamento permanece separado. Não ativar até provar que não existe processamento anterior por outras vias. Gate fechado, funções revogadas; sem teste/aplicação.
