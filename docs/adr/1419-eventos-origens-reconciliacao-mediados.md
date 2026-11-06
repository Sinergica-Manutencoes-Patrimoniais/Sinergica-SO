# ADR-1419 — Eventos locais mediados de reconciliação

## Decisão

Preparar entradas autenticadas para leitura paginada dos eventos locais Comercial e Financeiro, reutilizando as verificações de Cliente e capacidades das fontes. Não retorna valores, custos ou payload e não altera estados nem executa integração.

## Limites

Migration e tela não aplicadas nem testadas; gate fechado. Validar paginação, histórico incompleto, autorização/revogação, isolamento, RLS/FORCE e revisão adversarial. Eventos locais não provam efeito remoto.
