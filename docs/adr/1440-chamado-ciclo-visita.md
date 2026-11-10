---
name: "docs-adr-1440-chamado-ciclo-visita-md"
description: "Documento Sinérgica SO: ADR 1440 — Chamado preventivo por Visita"
alwaysApply: false
---

# ADR 1440 — Chamado preventivo por Visita

O ciclo canônico de Visita possui um Chamado único, em namespace separado do calendário. O comando consulta a Visita contratual, recusa cancelamento e supressão por feriado, confere origem e fotografia e registra o pedido idempotente. OS preexistente exige reconciliação; nenhuma OS ou tarefa externa é criada. O gate de criação permanece fechado.

Antes da homologação, conferir concorrência com supressão, mudanças de Visita, autorização, reconciliação de legados, vínculos de OS e revisão adversarial.
