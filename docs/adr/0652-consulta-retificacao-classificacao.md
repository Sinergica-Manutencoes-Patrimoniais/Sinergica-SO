---
name: "docs-adr-0652-consulta-retificacao-classificacao-md"
description: "Documento Sinérgica SO: ADR-0652 — Consulta de retificação e revisão"
alwaysApply: false
---

# ADR-0652 — Consulta de retificação e revisão

Consulta restrita por Cliente e classificação expõe a solicitação e sua revisão interna, sem modificar o snapshot nem afirmar efetivação. A interface opera com pedidos idempotentes; permissões continuam no servidor. Gate fechado e sem grants; testar antes da ativação.
