# ADR-1415 — Correção mediada de faturável

## Decisão

Conectar consulta de alocações, complemento e estorno lógico por entradas que verificam ator, Cliente, capacidade e gates, mantendo os núcleos anteriores privados. Não é estorno bancário, não altera diretamente o lançamento e não envia cobrança.

## Limites

Gates nascem fechados; migration não aplicada nem testada. Validar competência fechada, concorrência com lançamento e alocação, replay, revogação, lock dos gates, RLS/FORCE, reconciliação financeira e revisão adversarial antes de habilitar.
