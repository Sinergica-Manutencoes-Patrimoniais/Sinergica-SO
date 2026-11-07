---
name: "docs-adr-1563-escolha-visita-e-vigencia-md"
description: "Documento Sinérgica SO: ADR-1563 — Escolha atual de Visita e vigência da substituição"
alwaysApply: false
---

# ADR-1563 — Escolha atual de Visita e vigência da substituição

Decisões históricas permanecem imutáveis, mas não reservam permanentemente uma Visita candidata após serem substituídas por outra decisão. O comando recusa reutilização apenas quando outra ocorrência mantém escolha atual para a mesma Visita, Rotina, Cliente, Plano e revisão, sob protocolo transacional existente. O selo aprovado continua único para impedir duas substituições efetivas.

Materialização de candidato com substituição selada antes da vigência deve falhar na mesma transação, não criar uso sem vínculo. A partir da vigência, o trigger existente revalida fontes, fila, identidade e feriados antes de vincular. O histórico, OS e guarda 1045 permanecem intactos. Validar replay, escolhas substituídas, candidatos em disputa, data futura, concorrência e rollback em clone antes de habilitar.
