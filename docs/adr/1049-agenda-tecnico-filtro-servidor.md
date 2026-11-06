# ADR-1049 — Consulta de agenda por técnico no servidor

**Status:** preparação não homologada.

Oferecer consulta paginada por Cliente, semana e ID de técnico, com filtro aplicado antes da paginação. Preservar `SECURITY INVOKER`, RLS da agenda e a mesma capacidade e trava da consulta anterior. A resposta contém somente alocações manuais daquele Cliente, não comprova capacidade, conflito em outros Clientes, execução ou completude. Não alterar consulta anterior nem estados de agendamento.

Gate adicional e flag nascem desligados. Antes de liberar, validar RLS e autorização efetivas, revogação, limites de datas, paginação concorrente, desempenho e índices por volume, troca de sessão e revisão adversarial. Não habilitar somente com base na interface.
