---
name: "docs-adr-1625-replay-decisao-pmoc-md"
description: "Documento Sinérgica SO: ADR 1625: recibo idêntico no replay de decisão PMOC"
alwaysApply: false
---

# ADR 1625: recibo idêntico no replay de decisão PMOC

O replay do núcleo de decisão devolvia os campos persistidos, mas omitia `deduplicacaoAtiva:false`, sempre presente na resposta original. A resposta reproduz agora o mesmo recibo, sem modificar decisões históricas ou seus dados. A autorização e a validação de request permanecem anteriores ao replay.
