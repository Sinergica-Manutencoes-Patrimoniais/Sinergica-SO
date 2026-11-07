---
name: "docs-adr-0151-priorizacao-composicoes-backlog-md"
description: "Documento Sinérgica SO: ADR-0151 — Priorização e consulta das composições"
alwaysApply: false
---

# ADR-0151 — Priorização e consulta das composições

## Decisão

Acrescentar fatores G/U/T e dor do Cliente à composição, todos inicialmente desconhecidos; uma decisão explícita e auditada define G/U/T e opcionalmente D. A consulta por Cliente calcula score com os pesos atuais `config.priorizacao_gutd`, conforme a fórmula de priorização existente (D ausente redistribui peso de G/U/T). Sem fatores ou configuração, score permanece desconhecido, jamais um valor inventado. Ordenação é score decrescente, desconhecidos ao final, UUID como desempate; paginação por cursor e autorização atual.

## Limites

Consulta e escrita revogadas, gate fechado. Paginação pode exigir reinício se configuração ou fatores mudarem entre páginas; não fornece snapshot imutável. Ainda não integra o ranking legado da fila de OS nem implementa promoção/devolução. Validar acesso, concorrência, auditoria e contratos antes de ativação.
