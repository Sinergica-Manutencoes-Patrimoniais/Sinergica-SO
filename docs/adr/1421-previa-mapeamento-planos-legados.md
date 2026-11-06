# ADR-1421 — Prévia do mapeamento de Planos legados

## Decisão

Exibir, por Cliente e página, identidade legada e destino observado, rotina/versão registradas e classificação conservadora. A comparação sinaliza fonte alterada, alvo ambíguo ou indisponível, identidade de destino ocupada, destino sem correspondência e mapeamento inconsistente; não revela dados de outro Cliente, aprova ou altera registros. Origem sem destino observado não afirma que outra entidade equivalente não exista.

## Limites

Migration e interface não aplicadas nem testadas; dependem do gate de pré-conferência fechado. Validar autorização/revogação, sensibilidade da fotografia, concorrência entre páginas, identidades, reversões, RLS/FORCE, privacidade e revisão adversarial. Resultado não prova equivalência, completude ou aceite de migração.
