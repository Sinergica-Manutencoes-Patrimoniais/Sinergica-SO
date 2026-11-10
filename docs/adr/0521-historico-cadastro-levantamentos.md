---
name: "docs-adr-0521-historico-cadastro-levantamentos-md"
description: "Documento Sinérgica SO: ADR-0521 — Histórico de cadastro por lote"
alwaysApply: false
---

# ADR-0521 — Histórico de cadastro por lote

Consulta paginada por Cliente, tipo e cadastro oficial reúne criação, vínculo ou atualização registrada em lotes de levantamento. Identifica operação pelo comando auditado, sem inferir quando ausente; localização atualizada pela trilha separada é identificada explicitamente. Não retorna conteúdo bruto do lote. A consulta exige cadastro ativo e autorização; gate desligado, sem concessões. Revisão de isolamento, desempenho e testes antes de ativar.
