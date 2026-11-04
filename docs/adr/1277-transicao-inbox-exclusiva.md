# ADR-1277 — Transição exclusiva de entrada de campo

Status: proposta local; não habilitada nem homologada.

Preparar modo explícito em que webhook e polling entregam as tarefas capturadas à inbox e não seguem para criação ou atualização legada de OS. Se a captura correspondente não estiver habilitada, o modo exclusivo falha fechado; falta de identidade, formato inválido, falha ou resultado incerto de captura também não deve ser declarado sucesso. A resposta de captura não afirma que Chamado, OS ou execução foram processados.

O modo nasce desligado. Não ativar até existir processamento assíncrono operacional da inbox, reconciliação e visibilidade dos pendentes, cobertura de todos caminhos legados, plano de transição e rollback, validação de eventos e paginação, concorrência, backpressure, retenção, testes e revisão adversarial. Habilitar sem executor causaria acúmulo e interromperia a atualização operacional existente; não configura agendamento nem executa tarefas Auvo.
