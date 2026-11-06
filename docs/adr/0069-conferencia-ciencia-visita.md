---
name: "docs-adr-0069-conferencia-ciencia-visita-md"
description: "Documento Sinérgica SO: ADR-0069 — Conferência informativa da ciência da Visita"
alwaysApply: false
---

# ADR-0069 — Conferência informativa da ciência da Visita

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

Consulta autorizada apresenta política atual, confirmação PCM da revisão atual e existência de ciência completa ligada à confirmação, ou registrada na revisão de conteúdo imediatamente anterior à confirmação. Ciência com data futura não conta como ocorrida. Alteração de conteúdo incrementa revisão, portanto ciência de revisão anterior não autoriza a revisão alterada. Ausência de política equivale a sem controle; modo informativo não exige ciência; modo obrigatório exige evidência correspondente.

O resultado é apenas conferência pontual, não autorização para enviar nem promessa de capacidade, prazo T−24 ou integração. E01-S168 deve repetir validações sob locks na transação de intenção, reavaliar política, revisão e evidência e tratar concorrência/cancelamento. Não há chamada ou outbox externa nesta consulta.
