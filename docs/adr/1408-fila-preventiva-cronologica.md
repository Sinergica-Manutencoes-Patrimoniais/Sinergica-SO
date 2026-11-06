---
name: "docs-adr-1408-fila-preventiva-cronologica-md"
description: "Documento Sinérgica SO: ADR-1408 — Consulta cronológica da fila preventiva"
alwaysApply: false
---

# ADR-1408 — Consulta cronológica da fila preventiva

## Decisão

Acrescentar leitura paginada pela data de vencimento original e ID canônico, com filtro por estado e período no servidor. A entrada reutiliza o gate e a capacidade de gestão do Plano, não cria ou modifica registros e não aciona Auvo. A consulta anterior permanece disponível para rollout coordenado.

## Limites

O cursor não garante fotografia transacional entre páginas. Migration não aplicada ou testada; validar concorrência, índice e volume, permissões e revogação, RLS/FORCE, paginação e revisão adversarial antes de habilitar o consumidor. Ausência na fila não prova ausência de execução.
