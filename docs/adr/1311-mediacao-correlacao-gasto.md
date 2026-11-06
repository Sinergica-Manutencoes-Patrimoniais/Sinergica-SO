---
name: "docs-adr-1311-mediacao-correlacao-gasto-md"
description: "Documento Sinérgica SO: ADR-1311 — Mediação da correlação de gastos"
alwaysApply: false
---

# ADR-1311 — Mediação da correlação de gastos

## Decisão

Preparar entradas autenticadas para consultar, declarar e decidir correlações
entre aquisição e parcela de despesa. Os núcleos existentes permanecem
privados e preservam verificações de ator, quatro capacidades, Cliente,
gates, vínculos, revisão e auditoria. Um gate adicional fechado controla as
entradas mediadas; a interface usa flag própria desligada.

Correlação é declaração humana, não prova identidade física nem resolve
exclusividade de todas as origens financeiras. Nenhuma operação cria
faturável, altera orçamento anterior ou efetua cobrança.

## Antes de habilitar

Validar fontes, autorizações/revogação, RLS/FORCE, concorrência em ambas
ordens, revisão, replay, paginação, privacidade e revisão adversarial.
Implantação da interface e banco deve ser coordenada.
