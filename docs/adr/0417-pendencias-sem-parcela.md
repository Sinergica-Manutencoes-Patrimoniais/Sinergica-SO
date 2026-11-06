---
name: "docs-adr-0417-pendencias-sem-parcela-md"
description: "Documento Sinérgica SO: ADR-0417 — Pendências sem parcela na composição"
alwaysApply: false
---

# ADR-0417 — Pendências sem parcela na composição

O seletor existente mostra somente pendências abertas e com revisão compatível. Prepara-se consulta privada paginada que também identifica pendências sem parcela cuja revisão mudou ou estado deixou de ser aberto, sem vinculá-las automaticamente. A situação é diagnóstica e não autoriza atribuição.

Gate e execução fechados; testar isolamento de Cliente, paginação e concorrência antes de ativar.
