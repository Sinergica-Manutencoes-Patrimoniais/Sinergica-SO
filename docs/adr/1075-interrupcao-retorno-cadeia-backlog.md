---
name: "docs-adr-1075-interrupcao-retorno-cadeia-backlog-md"
description: "Documento Sinérgica SO: ADR-1075 — Interrupção e consulta de retorno em cadeia de OS"
alwaysApply: false
---

# ADR-1075 — Interrupção e consulta de retorno em cadeia de OS

Status: proposta local, não aplicada nem homologada.

## Contexto

As funções de declaração de interrupção e consulta de retorno parcial, assim como a guarda de interrupção, reconhecem apenas a atribuição inicial de uma parcela. Isso impede tratar a parcela quando a OS anterior é uma continuação formalmente vinculada. A simples existência de uma OS no mesmo Chamado não comprova essa relação.

## Decisão

Usar a fonte privada de vínculo da migration 1220 também nesses três consumidores. Exigir exatamente uma parcela reconhecida para a OS e identidade igual à parcela da operação. A fonte aceita atribuição explícita ou vínculo imutável de continuidade cuja proposta está executada e coerente; nenhuma relação é inferida por título ou por Chamado. Preservar permissões, gates, autorização, auditoria e demais precondições existentes. A declaração de interrupção para ciclos legados continua fora dessa alteração.

## Limites e validação necessária

A guarda de interrupção é compartilhada e pode afetar outros caminhos após implantação; inventariar todos antes de qualquer rollout. A alteração não comprova parada, execução, cobertura ou retorno integral, nem valida todas as cadeias e escritores. Verificar transações e ordem de locks, corridas com revogação ou edição de vínculos, inconsistências legadas, múltiplas parcelas, clientes distintos, repetição e revisão adversarial no esquema completo. Manter gates existentes fechados até comprovação. Nenhuma mudança em ambiente oficial ou envio ao Auvo está autorizado por esta decisão.
