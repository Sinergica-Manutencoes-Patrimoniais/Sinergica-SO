---
name: "docs-adr-1427-historico-custos-proposta-escopado-md"
description: "Documento Sinérgica SO: ADR-1427 — Histórico de custos por versão"
alwaysApply: false
---

# ADR-1427 — Histórico de custos por versão

Complementa ADR-1425: consulta interna paginada projeta somente totais numéricos de cada versão preservada, autorizada por Cliente e `custo.ler`. Não devolve o payload privado integral, altera versões ou usa a composição atual como substituta. Formatos históricos ausentes ou inválidos permanecem sem valor.

Antes de ativar: verificar vínculos de Cliente, migrações legadas, precisão numérica, revogação, paginação, RLS/FORCE e revisão adversarial. Gate de ADR-1425 permanece fechado.
