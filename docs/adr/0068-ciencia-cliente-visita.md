---
name: "docs-adr-0068-ciencia-cliente-visita-md"
description: "Documento Sinérgica SO: ADR-0068 — Evidência de ciência do Cliente"
alwaysApply: false
---

# ADR-0068 — Evidência de ciência do Cliente

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

Ciência e confirmação PCM são independentes. Gestor autorizado registra evidência completa (data, responsável informado, canal e observação) em Visita planejada ou confirmada, sempre associada à revisão observada e sem modificar o conteúdo da Visita. O histórico é append-only; correção é novo registro, nunca sobrescrita. Revisão otimista, bloqueio da Visita, requestId, ator e auditoria evitam registro em conteúdo diferente do conferido. Em Visita confirmada, registra também a confirmação PCM correspondente. Antes da confirmação, registra a revisão de conteúdo observada, sem antecipar aprovação ou envio.

O futuro contrato de envio deve decidir e testar a validade da evidência em relação ao snapshot confirmado e à política atual, incluindo ciência registrada antes da confirmação e mudanças posteriores. Este registro por si só não libera envio, não altera a agenda e não dispara Auvo.
