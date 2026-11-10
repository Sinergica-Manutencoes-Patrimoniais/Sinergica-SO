---
name: "docs-adr-1428-itens-historicos-custo-md"
description: "Documento Sinérgica SO: ADR-1428 — Itens históricos da proposta"
alwaysApply: false
---

# ADR-1428 — Itens históricos da proposta

Consulta interna de uma versão devolve somente itens explícitos no snapshot da própria versão, com autorização do ADR-1425. Versões sem lista de itens são marcadas como indisponíveis; a composição atual não é usada como substituta. O retorno é limitado e não inclui fornecedor, payload completo ou outros campos do snapshot. Edição continua em fluxo separado.

Gate existente permanece fechado. Validar formatos históricos, limites, autorização por Cliente, concorrência, RLS/FORCE e revisão adversarial antes da ativação.
