# ADR-1148 — Outbox única para candidatas T−24

Status: proposta local; migrations e consumidores não homologados, gates fechados.

A outbox existente é a única fila para novos envios T−24. Cada tentativa do livro experimental deve referenciar uma linha exclusiva da outbox com entidade reservada `ordens_servico_t24`, `row_id` da OS e operação correspondente. O livro mantém fotografia, fence e histórico, mas não representa trabalho independente da outbox. O drain legado ignora essa entidade; a reserva específica bloqueia primeiro a linha da outbox, depois o livro, e altera ambos na mesma transação. Reserva expirada sem início pode ser tomada novamente; efeito iniciado ou incerto não é reivindicado.

Esta etapa não cria produtor, não altera estados finais da outbox nem concede execução à reserva. Faltam produtor transacional a partir de fontes oficiais, resultado e reconciliação coordenados com a outbox, integração e proteção de caminhos legados de OS, controles de elegibilidade e contrato Auvo, tratamento de cancelamento e confirmação, políticas de operação e revisão adversarial. Não inserir essa entidade nem habilitar gates até todas as peças estarem coordenadas. Validar locks de todos os consumidores, segurança/RLS, limites, compatibilidade de rollout e concorrência antes de qualquer aplicação em ambiente oficial.
