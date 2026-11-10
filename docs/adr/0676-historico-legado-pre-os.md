---
name: "docs-adr-0676-historico-legado-pre-os-md"
description: "Documento Sinérgica SO: ADR-0676 — Histórico interno de orçamentos pré-OS"
alwaysApply: false
---

# ADR-0676 — Histórico interno de orçamentos pré-OS

Consulta por Cliente retorna apenas orçamentos legados sem OS e com requisição do mesmo Cliente; não infere relação com a OS aberta. Projeção contém identificadores, número, estados e datas de decisão; omite valores, itens, descrições e motivos livres. Decisão divergente de Cliente não é exposta; ausência no escopo não prova inexistência. Registros de Cliente/requisição inconsistente ficam fora da consulta.

Permissão `orcamento.emitir` é revalidada server-side para o Cliente, com gate fechado e sem grants adicionais. A interface informa que é uma consulta do Cliente, não da OS. Não altera ou reemite dados. Revisar alçada, integridade, RLS e testar isolamento/revogação e paginação antes de ativar.
