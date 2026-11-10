---
name: "docs-adr-1382-guarda-esforco-visita-suprimida-md"
description: "Documento Sinérgica SO: ADR-1382 — Guarda de esforço em Visita suprimida"
alwaysApply: false
---

# ADR-1382 — Guarda de esforço em Visita suprimida

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Aplicar à inserção de declarações de esforço por ocorrência de Visita a guarda transacional já usada pelos vínculos da ocorrência. Quando houver supressão por feriado, a declaração nova é recusada; declarações históricas não são apagadas. Declarações de esforço por OS ou por calendário não são afetadas.

## Limites

A guarda não transforma dados antigos em zero e não substitui filtros dos leitores ou proteção dos demais escritores. Não libera supressão de Grupo. Validar gates, concorrência nas duas ordens, RLS/FORCE, clientes, histórico, compatibilidade de escritores e revisão adversarial antes da implantação.
