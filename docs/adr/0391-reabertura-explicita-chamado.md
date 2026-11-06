# ADR-0391 — Reabertura explícita de Chamado

Status: proposta, não homologada.

Um operador com `chamado.encerrar` pode reabrir explicitamente Chamado com marcador de encerramento conferido, motivo obrigatório e revisão esperada. A transação preserva em histórico imutável a data e o responsável pelo encerramento anterior, remove o marcador sob token privado da guarda 0615 e não reabre ou altera qualquer OS, parcela ou continuidade. Um Chamado cancelado não é reaberto por este comando. A aptidão para novo encerramento precisa ser calculada novamente.

Gate próprio e EXECUTE fechados; política de capacidade para reabertura, concorrência com escritores antigos e testes/revisão adversarial são pendentes. Não há efeito Auvo.
