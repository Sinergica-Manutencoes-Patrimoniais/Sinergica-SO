# ADR-1238 — Vínculo exclusivo entre aceite e lote de rascunhos

## Decisão

Preparar vínculo imutável de cada aceite a um único requestId de lote e de cada lote ao seu aceite. A criação e o vínculo ocorrem na mesma transação, sob trava por aceite; repetição idêntica retorna o recibo proprietário, enquanto aceite ou lote usados com outra combinação são recusados. O aceite passa a validar previamente os campos e identidades necessários ao comando de criação.

## Limites

O vínculo não comprova equivalência, integridade de todos os leitores ou ausência de dependências. Não altera Planos legados nem autoriza migração real. Gates continuam fechados. Validar concorrência entre operadores, timeout e replay, consistência dos recibos, ordem global de locks, permissões/RLS e rollback antes de habilitar; interface e testes integrados permanecem pendentes.
