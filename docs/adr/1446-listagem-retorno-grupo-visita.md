---
name: "docs-adr-1446-listagem-retorno-grupo-visita-md"
description: "Documento Sinérgica SO: ADR 1446 — Listagem de retornos por Grupo e Visita"
alwaysApply: false
---

# ADR 1446 — Listagem de retornos por Grupo e Visita

A listagem de envelopes classificáveis consulta as fontes de calendário legado, Visita legada e Grupo, incluindo Grupo vinculado ao Chamado do mesmo ciclo. Exige uma única origem, Cliente, tarefa externa, fotografia aprovada e alvo correspondente. Perguntas vêm da fotografia; registros ambíguos não são apresentados como classificáveis.

As permissões privadas e os bloqueios existentes permanecem. Validar paginação, desempenho, ambiguidades, isolamento, concorrência e classificação de ponta a ponta antes de habilitar.
