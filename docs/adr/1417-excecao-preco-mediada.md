# ADR-1417 — Exceção de preço mediada

## Decisão

Preparar entradas autenticadas para consultar piso e registrar exceção, com Cliente explícito, autorização atual e gates separados. A operação existente mantém sua regra de administrador, revisão, motivo e nova versão; o núcleo permanece privado. Nenhuma proposta é enviada.

## Limites

Migration não aplicada nem testada; gates fechados. Validar proteção de custos, concorrência, origem da proposta, replay, autorização/revogação, RLS/FORCE, versões históricas e revisão adversarial antes de habilitar.
