---
name: "docs-adr-1487-propostas-pmoc-mediadas-md"
description: "Documento Sinérgica SO: ADR-1487 — Conferência PMOC mediada"
alwaysApply: false
---

# ADR-1487 — Conferência PMOC mediada

## Contexto
A interface de diagnóstico e proposta PMOC chamava funções privadas e não conseguia registrar ou consultar decisões.

## Decisão
Preparar RPCs mediadas que conferem identidade de sessão, autorização atual e gates privados; decisões exigem também `cadastro.aprovar`. Operações canônicas mantêm validações, revisão, idempotência e auditoria. Gates inicialmente fechados. A interface recupera a mesma tentativa após falha e verifica sessão antes e depois.

## Limites
Coincidência de data, proposta ou decisão PCM não comprovam equivalência de alvo/contrato nem ativam deduplicação. Testar revogação, acesso entre Clientes, concorrência, paginação, replay e locks antes de habilitar. Sem alteração de PMOC, geração real, deploy ou Auvo.
