# ADR-1208 — Consulta mediada da hierarquia de levantamento

## Decisão

Preparar entrada autenticada para o diagnóstico privado de hierarquia do lote S178. A entrada exige identidade atual do ator e capacidade `cadastro.aprovar`; o núcleo mantém gate, Cliente, revisão e paginação, sem conceder acesso direto às tabelas ou à função privada.

O diagnóstico cobre somente vínculos no lote. Ausência de alerta não comprova cadastro externo, integridade global ou aprovação. O resultado não modifica ou incorpora linhas.

## Gates

Interface e gate permanecem fechados até validar revisões concorrentes, isolamento/RLS, ordenação, ciclos, desempenho, revogação e revisão adversarial. A consulta paginada não constitui snapshot entre chamadas.
