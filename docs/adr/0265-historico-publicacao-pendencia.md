---
name: "docs-adr-0265-historico-publicacao-pendencia-md"
description: "Documento Sinérgica SO: ADR-0265 — Histórico interno de comunicação de pendência"
alwaysApply: false
---

# ADR-0265 — Histórico interno de comunicação de pendência

Status: proposta; não ativar antes de testes e revisão de segurança.

O PCM consulta publicações por pendência e Conta, com autorização atual verificada no servidor. A lista identifica revisão, texto e revogação, inclusive registros obsoletos; a revogação exige justificativa e utiliza o comando auditado da ADR-0261. O Portal não recebe esse histórico. A ADR-0266 permite republicar na mesma revisão como nova publicação, sem restaurar a anterior. Função e interface permanecem fechadas.
