---
name: "docs-adr-1313-recibo-correlacao-gasto-md"
description: "Documento Sinérgica SO: ADR-1313 — Recibo da declaração de correlação de gasto"
alwaysApply: false
---

# ADR-1313 — Recibo da declaração de correlação de gasto

Consulta autenticada do request e payload exatos, com as capacidades atuais
e vínculo Cliente/lista/OS conferido. Usa a mesma trava do comando; não repete
a declaração. Recibo ausente não prova falha, e recibo encontrado não prova
identidade física das fontes, exclusividade financeira ou cobrança.

Antes de habilitar: validar normalização, vínculo e transferência, revogação,
concorrência com commit, RLS/FORCE, permissões e revisão adversarial.
