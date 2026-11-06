---
name: "docs-adr-1101-preservar-reprogramacao-visita-md"
description: "Documento Sinérgica SO: ADR-1101 — Preservação de Visita com reprogramação anterior"
alwaysApply: false
---

# ADR-1101 — Preservação de Visita com reprogramação anterior

Status: proposta local, não aplicada nem homologada.

## Decisão

Na prévia e na base do comando de mudança de dia, uma Visita com registro de reprogramação anterior não é candidata à movimentação automática, mesmo se seu horário atual coincidir com o da regra. Horário igual não apaga a decisão histórica. A Visita permanece para conferência e nenhuma tarefa Auvo é alterada.

## Limites

Esse histórico não cobre necessariamente reprogramações legadas ou outros caminhos de edição. Inventariar exceções e escritores, verificar concorrência e revisar o tratamento de ocorrências, feriados e versões antes de ativar. Nenhum teste ou deploy é implícito nesta decisão.
