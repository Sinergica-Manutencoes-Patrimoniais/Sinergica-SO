---
name: "docs-adr-0061-equipe-visita-md"
description: "Documento Sinérgica SO: ADR-0061 — Equipe da Visita"
alwaysApply: false
---

# ADR-0061 — Equipe da Visita

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

Participações vinculam funcionário existente à Visita e ao Cliente da Visita, com papel textual, estimativa opcional em minutos e histórico de encerramento. Um funcionário não pode ter duas participações vigentes na mesma Visita. Alteração inicial exige `visita.confirmar` atual, revisão e requestId, só é permitida em rascunho ou planejada e grava participação, revisão e auditoria atomicamente. O funcionário deve estar ativo no momento da associação.

Esta relação não substitui nem altera `pcm.agenda_tecnico`, não comprova disponibilidade, certificação ou capacidade e não confirma a Visita. Fechamento de participação, reconfirmação e sincronização operacional permanecem etapas próprias; nenhuma chamada ou intenção Auvo é criada.
