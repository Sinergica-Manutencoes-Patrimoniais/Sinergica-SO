---
name: "docs-adr-1628-serializacao-autorizacao-geracao-md"
description: "Documento Sinérgica SO: ADR 1628: serialização da autorização na geração"
alwaysApply: false
---

# ADR 1628: serialização da autorização na geração

A geração e a revogação de concessões devem observar ordem transacional inequívoca. As fronteiras de geração de Calendário e Visita adquirem a trava compartilhada já usada pela autorização, recusam disputa e exigem READ COMMITTED antes de consultar concessões ou replay. A revogação não pode confirmar entre a última verificação e o commit da geração. Gates existentes, Cliente e recibos não mudam.
