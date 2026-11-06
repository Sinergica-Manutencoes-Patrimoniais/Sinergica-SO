---
name: "docs-adr-0060-associar-os-visita-rascunho-md"
description: "Documento Sinérgica SO: ADR-0060 — Associação auditada de OS à Visita"
alwaysApply: false
---

# ADR-0060 — Associação auditada de OS à Visita

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

O comando adiciona OS não excluída do mesmo Cliente a Visita em rascunho ou planejada, mediante `visita.confirmar` atual, requestId, revisão esperada e sequência explícita. O Cliente é derivado da Visita; erro não revela se uma OS fora do escopo existe. Bloqueio da Visita, chave única por OS vigente e sequência única na Visita serializam concorrência e impedem duplicidade. Vínculo, revisão, auditoria e resultado idempotente são atômicos.

Uma Visita confirmada ou posterior não é alterada por este comando até existir invalidação transacional de confirmação e controle de integração. Este incremento não muda OS, referência Auvo, agenda legada ou outbox; reprogramação e desvinculação seguem etapas próprias.
