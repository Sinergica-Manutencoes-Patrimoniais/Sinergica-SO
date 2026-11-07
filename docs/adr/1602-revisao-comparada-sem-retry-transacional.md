---
name: "docs-adr-1602-revisao-comparada-sem-retry-transacional-md"
description: "Documento Sinérgica SO: ADR 1602 — Conflito de revisão da decisão comparada"
alwaysApply: false
---

# ADR 1602 — Conflito de revisão da decisão comparada

Status: aceito para implementação; homologação pendente.

Uma decisão comparada submetida com revisão do Plano obsoleta recebeu `40001`, provocando milhares de reexecuções automáticas pelo PostgREST. A guarda específica da revisão e as listas mediadas reconsultadas após o conflito passam a retornar `P0011` e `revisao_obsoleta`; erros reais de serialização não são convertidos. As interfaces de Calendário e Visita tratam esse par na primeira tentativa como rejeição definitiva, preservando replay quando o resultado anterior é incerto. Demais conflitos `40001` de outras funções ainda exigem análise. A mudança não aciona Auvo.
