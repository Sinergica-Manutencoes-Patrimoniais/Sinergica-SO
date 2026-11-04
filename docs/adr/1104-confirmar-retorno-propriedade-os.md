# ADR-1104 — Confirmação de retorno da propriedade de OS

Status: proposta local, não aplicada nem homologada.

## Decisão

Quando a OS voltar ao Cliente ao qual já pertencia sua observação, permitir a operador autorizado confirmar essa situação, com revisão do conflito, motivo, requestId e auditoria. Preservar integralmente as observações e eventos anteriores. A decisão só se aplica à revisão e ao Cliente conferidos; não transfere histórico nem decide o caso em que a OS continua em Cliente diferente.

## Limites

Uma transferência posterior precisa produzir nova conferência; ausência de evento ou revisão nova não prova estabilidade. A função e interface permanecem fechadas até validação de locks, repetição, troca de Cliente, revogação, RLS/FORCE e revisão adversarial. O caso de transferência definitiva continua exigindo procedimento próprio.
