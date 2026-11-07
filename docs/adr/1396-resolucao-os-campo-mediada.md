---
name: "docs-adr-1396-resolucao-os-campo-mediada-md"
description: "Documento Sinérgica SO: ADR-1396 — Resolução manual de OS para origem de campo"
alwaysApply: false
---

# ADR-1396 — Resolução manual de OS para origem de campo

Leitura de candidatas e resolução manual passam por entradas autenticadas com permissão global e do Cliente, gates fechados e identidade esperada. O núcleo existente mantém compatibilidade da tarefa, revisão e repetição. A resolução identifica vínculo local; não aplica evento, cria tarefa ou comprova conteúdo remoto.

Exigir testes de autorização, isolamento, concorrência com retificação, replay, compatibilidade das fontes, RLS/FORCE e revisão adversarial antes de aplicar ou habilitar.
