# ADR 1596: avaliação legada na fila por Visita

Avaliação recebida é evidência de execução e impede tratar como candidata inerte a Visita vinculada à ocorrência legada. A função de estado retorna indeterminado sob trava compartilhada de avaliações, impedindo retirada automática e preservando a conferência. Histórico e recibos anteriores não mudam.
