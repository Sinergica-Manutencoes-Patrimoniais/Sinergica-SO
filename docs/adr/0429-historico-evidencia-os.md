---
name: "docs-adr-0429-historico-evidencia-os-md"
description: "Documento Sinérgica SO: ADR-0429 — histórico de evidências declaradas de OS"
alwaysApply: false
---

# ADR-0429 — histórico de evidências declaradas de OS

Status: proposto; gates fechados, não aplicado nem homologado.

Consulta paginada exige permissão `integracao.reconciliar`, validação de Cliente e OS e ambos os gates. Expõe somente a declaração manual, identificada como não verificada; não apresenta resultado remoto como confirmado nem habilita reenvio. A interface fica atrás de flag desligada. Escopo, paginação, permissões e revisão de dados livres exigem testes antes da ativação.
