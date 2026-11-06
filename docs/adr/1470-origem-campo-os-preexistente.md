# ADR-1470 — Conferência de origem em OS preexistente

Status: preparação local, gates fechados; complementa ADR-1467/1468.

Ao vincular uma tarefa a uma OS preexistente, o recebimento não deve declarar que os campos do primeiro evento foram aplicados. Para novas vinculações processadas após esta migration, iniciar controle de revisão sem assumir propriedade automática dos campos. A prévia existente poderá comparar o primeiro evento e a OS atual; somente a confirmação PCM autorizada, com motivo, ordem, revisão e técnico conferidos, poderá aplicar os campos exibidos. Nenhum evento posterior dessas OS é aplicado automaticamente por este fluxo.

OS históricas sem controle continuam pendentes de reconciliação. A confirmação não encerra OS ou Chamado, não modifica status nem valida execução. Devem ser preservados códigos, identidade e dados fora dos campos conferidos. Requer validação de todos os escritores, vínculo, concorrência, replay, autorização e revisão adversarial antes da ativação. Nenhum deploy ou envio Auvo é autorizado.
