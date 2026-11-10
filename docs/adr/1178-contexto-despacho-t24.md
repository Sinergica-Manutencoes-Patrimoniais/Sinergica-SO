---
name: "docs-adr-1178-contexto-despacho-t24-md"
description: "Documento Sinérgica SO: ADR-1178 — Contexto de despacho da candidata T−24"
alwaysApply: false
---

# ADR-1178 — Contexto de despacho da candidata T−24

Status: proposta local, não aplicada nem homologada.

Registrar na candidata os identificadores locais e Auvo de Cliente e tipo de tarefa, além de título, descrição e prioridade originais da OS. Esses dados são necessários à montagem de criação e devem ser derivados e bloqueados nas fontes oficiais; não usar fallback por nome ou categoria. Concessão retorna a fotografia ao executor, que deve revalidá-la antes do efeito.

A fotografia não define mapeamento de prioridade, formato `taskType`/`taskTypeId` ou conversão de horário do fornecedor. Esses contratos seguem pendentes. Gate fechado, sem envio; validar migração ordenada, fontes, limites, concorrência, privacidade, RLS/FORCE e revisão adversarial antes de ativar.
