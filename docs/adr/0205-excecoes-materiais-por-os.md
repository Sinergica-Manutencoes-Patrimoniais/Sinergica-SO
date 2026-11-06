# ADR-0205 — Consulta de exceções por OS

## Decisão

Preparar consulta paginada de exceções de todas as listas de uma OS, com Cliente/OS compatíveis, capacidade `material.gerir` atual, cursor composto (lista, revisão) e projeção limitada dos dados de exceção. A UI é opcional, sob flag independente e integra a Central quando há filtro de OS. Consulta não altera OS, lista, compra ou Financeiro; função revogada.

## Limites

São eventos históricos de exceção, não um cálculo de pendências materiais ainda abertas. Dados inconsistentes, concorrência, políticas e paginação devem ser revisados/testados. Sem aplicação nesta rodada.
