---
name: "docs-adr-1386-registro-grupo-mediado-md"
description: "Documento Sinérgica SO: ADR-1386 — Registro mediado de ocorrência de Grupo"
alwaysApply: false
---

# ADR-1386 — Registro mediado de ocorrência de Grupo

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Preparar prévia e comando mediados para registrar identidade de Grupo em ocorrência preparada. A prévia distingue quantidade/revisão atuais do Grupo das congeladas na versão aprovada do Plano; a escrita exige a revisão atual conferida e o gate de quantidade aprovada, preservando o núcleo privado e sua idempotência. Leituras e escritas têm gates próprios desligados, exigem capacidade de gestão e respeitam a guarda de Visita suprimida. Nenhuma ação cria OS, fila ou tarefa Auvo.

## Limites

Não comprova execução nem disponibilidade externa. Validar snapshots antigos, ausência de quantidade aprovada, Cliente, versão, concorrência com alteração de Grupo e supressão, ACL/RLS/FORCE, replay, sessão, locks e revisão adversarial antes de habilitar.
