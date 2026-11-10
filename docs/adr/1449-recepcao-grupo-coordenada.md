---
name: "docs-adr-1449-recepcao-grupo-coordenada-md"
description: "Documento Sinérgica SO: ADR 1449 — Recepção declarada de retorno de Grupo"
alwaysApply: false
---

# ADR 1449 — Recepção declarada de retorno de Grupo

Sob a coordenação já existente, a barreira admite retorno manual declarado, decisão, pendência e finalização individual de Grupo quando Cliente, OS, vínculo explícito, Chamado do ciclo e fotografia aprovada coincidem. Pendências exigem resposta não OK da mesma OS e Grupo. A finalização exige aprovação atual, atestação, OS finalizada e pendências para respostas não OK, além das demais guardas do comando. A recepção não comprova cobertura nem execução; o gate permanece desligado.

Validar origem, locks, concorrência com vínculo e revogação, replay, RLS e revisão adversarial antes de habilitar.
