---
name: "docs-adr-1100-origem-despesa-ausente-md"
description: "Documento Sinérgica SO: ADR-1100 — Triagem de origem de despesa ausente"
alwaysApply: false
---

# ADR-1100 — Triagem de origem de despesa ausente

Status: proposta local, não aplicada nem homologada.

## Decisão

Incluir na varredura os faturáveis que declaram `origem_tipo=despesa_visita`, mesmo sem declaração de repasse ou sem despesa acessível no mesmo Cliente. Registrar como ausência a conferir, sem expor dados de outro Cliente, criar vínculo, corrigir faturável ou inferir fraude. Continuar incluindo declarações existentes cuja origem do faturável diverge.

## Limites

Ausência observada não comprova perda ou erro definitivo; pode refletir concorrência ou migração. Propostas sem oportunidade e sem vínculo não têm Cliente demonstrável apenas pelo registro consultado e não serão atribuídas a um Cliente por inferência. Validar integridade, isolamento, concorrência, paginação e revisão adversarial antes de ativar.
