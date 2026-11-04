# ADR-1234 — Aceite da prévia do lote de rascunhos

## Decisão

Preparar registro imutável do aceite explícito de uma seleção e suas fotografias de Planos legados. Antes do aceite, consultar cada origem pelo comando autorizado existente e rejeitar fotografia divergente ou Plano já presente. O processamento usa exatamente os itens aceitos e volta a conferir cada origem na transação de criação; aceite não substitui essa revalidação. A identidade, conteúdo, ator e Cliente vinculam o requestId e impedem repetição com dados diferentes.

## Limites

Esta prévia cobre somente seleção de Planos para rascunho: não classifica todos os registros legados, não comprova equivalência ou impactos e não autoriza migração completa. Gates e execução continuam privados e fechados; interface, cancelamento de aceite, revisão de permissões, privacidade, concorrência, replay e testes integrados permanecem pendentes. Não executar migração real nem enviar Auvo.
