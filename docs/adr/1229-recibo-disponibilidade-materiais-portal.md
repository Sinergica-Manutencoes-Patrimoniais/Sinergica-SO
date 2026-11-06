# ADR-1229 — Recibo de disponibilidade de materiais

## Decisão

Preparar consulta do recibo de disponibilidade pelo próprio ator, com Cliente, OS, lista e conteúdo integral da tentativa. A leitura reutiliza autorização e gate de materiais, confere o vínculo atual e busca somente comando registrado com payload correspondente. Ela não repete a escrita nem interpreta ausência de recibo como falha da operação.

## Limites e gates

Manter flag desligada até validar sessão e revogação concorrente, transferência de lista, privacidade, RLS/FORCE, commit em andamento, resposta perdida, múltiplas abas, ordem de travas e revisão adversarial. O vínculo atual pode impedir recuperação após mudança; exigir reconciliação humana. A interface inicial depende da lista ainda estar visível.
