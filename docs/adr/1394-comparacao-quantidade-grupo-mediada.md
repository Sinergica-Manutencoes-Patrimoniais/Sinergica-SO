---
name: "docs-adr-1394-comparacao-quantidade-grupo-mediada-md"
description: "Documento Sinérgica SO: ADR-1394 — Comparação de quantidade de Grupo mediada"
alwaysApply: false
---

# ADR-1394 — Comparação de quantidade de Grupo mediada

A comparação de fotografia histórica e cadastro atual usa entrada autenticada com `plano.gerir`, autorização coordenada e gate fechado. O núcleo permanece privado. A resposta distingue valores ausentes e não altera fotografia ou comprova vigência integral.

Aplicar e testar ACL/RLS/FORCE, concorrência, autorização/revogação, snapshots legados, datas e revisão adversarial antes de habilitar. Nenhuma OS ou tarefa é criada.
