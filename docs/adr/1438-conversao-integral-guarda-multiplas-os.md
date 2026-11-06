---
name: "docs-adr-1438-conversao-integral-guarda-multiplas-os-md"
description: "Documento Sinérgica SO: ADR 1438 — Conversão integral e guarda de múltiplas OS"
alwaysApply: false
---

# ADR 1438 — Conversão integral e guarda de múltiplas OS

A conversão integral passa a emitir a autorização privada e transacional usada pela guarda de criação e pela numeração compatível de OS. A autorização identifica transação, ator, Cliente, Chamado e OS; é removida após a inserção e é revertida junto com qualquer falha da transação. Durante a escrita usa também a proteção transacional de sincronização, restaurando o valor anterior em seguida. A migration valida a definição esperada antes de modificá-la e não altera gates, dados ou restrições legadas.

A transição 1:N continua dependente de rollout coordenado, revisão dos consumidores, testes de concorrência e revisão adversarial. Não executar o roteiro de transição em ambiente oficial antes dessas validações.
