---
name: "docs-adr-0663-ranking-backlog-por-alvo-md"
description: "Documento Sinérgica SO: ADR-0663 — Filtro de ranking por alvo"
alwaysApply: false
---

# ADR-0663 — Filtro de ranking por alvo

Consulta filtra Cliente, tipo e ID de alvo antes da paginação, usando a mesma fórmula e ordenação do ranking consistente 0661. A assinatura inclui Cliente e filtro, composições, vínculos e pesos; mudanças obrigam reinício e impedem reutilizar cursor de outro filtro. Permissão é verificada por Cliente; nenhum dado é alterado.

O filtro seleciona somente composições existentes, não comprova que um alvo sem resultados não possua Pendências externas a essa fonte. Gates e concessões permanecem fechados; revisão de concorrência, escala, testes e homologação pendentes.
