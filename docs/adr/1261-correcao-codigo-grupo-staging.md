# ADR-1261 — Correção de código de Grupo em staging

**Status:** proposta local, não homologada. Complementa ADR-1252/1253.

Preparar o fluxo existente de correção auditada do código informado e candidato para aceitar Grupo Quantitativo sob gate específico fechado. A alteração reabre a conferência e preserva o histórico da linha; não altera código oficial, não cria alias nem reserva o código. Incorporação posterior deve validar colisões e revisão na transação.

Antes de abrir gate, validar bloqueios e permissões, revisão, colisão de códigos, lote parcialmente incorporado, reabertura de conferência, replay, histórico e RLS/FORCE, além de revisão adversarial. Não alterar códigos existentes ou tarefas Auvo.
