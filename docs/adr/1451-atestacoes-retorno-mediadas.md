---
name: "docs-adr-1451-atestacoes-retorno-mediadas-md"
description: "Documento Sinérgica SO: ADR 1451 — Histórico de atestações mediado"
alwaysApply: false
---

# ADR 1451 — Histórico de atestações mediado

O histórico de atestações usa entrada autenticada, autorização atual do Cliente e coordenação de acesso, mantendo privado o núcleo anterior. A leitura depende dos gates existentes fechados por padrão e não altera decisão ou execução.

Validar ACL, sessão, paginação, concorrência com revogação e revisão adversarial antes de habilitar.
