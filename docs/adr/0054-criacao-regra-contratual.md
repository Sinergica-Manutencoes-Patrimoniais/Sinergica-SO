---
name: "docs-adr-0054-criacao-regra-contratual-md"
description: "Documento Sinérgica SO: ADR-0054 — Criação auditada de regra contratual"
alwaysApply: false
---

# ADR-0054 — Criação auditada de regra contratual

**Status:** decisão para implementação local E01-S166. **Data:** 2026-10-27.

O comando inicial cria série e primeira versão na mesma transação, identifica Cliente pelo contrato comercial e exige concessão atual `plano.gerir`. Entrada inclui identidade e revisão esperada zero, requestId e dados explícitos de regra; repetição idêntica devolve o resultado original, enquanto mesmo requestId com payload diferente conflita. Autorização é reavaliada antes de qualquer retorno de retry. Auditoria registra ator, conteúdo e correlação; falha desfaz todo o comando.

A criação não altera contrato, não cria Visita/Ocorrência nem enfileira integração. Versões subsequentes, alterações com impacto, exceções, prevenção de concorrência na concessão e integração com E01-S171 continuam separadas e não são consideradas homologadas.
