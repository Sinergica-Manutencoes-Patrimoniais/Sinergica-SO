---
name: "docs-adr-0659-aprovacao-parcial-campos-md"
description: "Documento Sinérgica SO: ADR-0659 — Retrato de campos estruturados na aprovação parcial"
alwaysApply: false
---

# ADR-0659 — Retrato de campos estruturados na aprovação parcial

Status: proposta; gates fechados, não homologada.

A decisão parcial pode registrar o retrato explicitamente selecionado pelo PCM para campos de localização, Sistema ou Componente, somente quando corresponde à última edição e foi conferido no ciclo atual. A decisão congela o retrato junto à linha; divergência impede aprovação. A seleção não libera escrita oficial por si: comandos existentes continuam exigindo aprovação integral até serem adaptados sem afrouxar seus demais guardas.

Sem testes ou migração aplicada. Antes da integração oficial, adaptar os comandos 0756, 0767 e 0845 para reconhecer a aprovação parcial da própria linha, respeitando snapshots oficiais, ciclo, autorização e sincronização. Sem isso, não declarar AC completo.
