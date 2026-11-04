# ADR-1312 — Recibo de decisão sobre correlação de gasto

## Decisão

Preparar consulta de recibo para o mesmo ator, Cliente, correlação, revisão,
ação e motivo, usando a trava do request e as capacidades exigidas pela
decisão. A entrada confirma vínculo atual com a lista e não repete a escrita.
Ausência de recibo não prova falha; preservar a tentativa.

O recibo não comprova exclusividade financeira, não altera orçamento e não
gera cobrança. Antes de habilitar, validar sessão/revogação, Cliente, origem,
locks, replay, paginação, RLS/FORCE, normalização e revisão adversarial.
