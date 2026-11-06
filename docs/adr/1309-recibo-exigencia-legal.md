# ADR-1309 — Recibo de declaração de exigência

## Decisão

Permitir que o mesmo ator consulte, com autorização atual, o resultado de um
request de exigência exatamente correspondente ao conteúdo enviado. Usar a
trava do request, manter o gate de exigência e não repetir a escrita. Ausência
de recibo não comprova que o pedido falhou e não cancela a tentativa.

Nenhuma consulta valida a norma, a tolerância ou o snapshot. Antes de habilitar,
validar normalização, concorrência, revogação, transferência, RLS/FORCE,
recuperação de tentativas antigas e revisão adversarial.
