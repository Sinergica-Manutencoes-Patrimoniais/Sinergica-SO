---
name: "docs-adr-0613-conferencia-campos-localizacao-md"
description: "Documento Sinérgica SO: ADR-0613 — Conferência versionada de campos de localização"
alwaysApply: false
---

# ADR-0613 — Conferência versionada de campos de localização

Status: proposta; gate fechado, não homologada.

O PCM confirma o retrato completo da declaração 0831, sua revisão, ciclo, motivo e linha já conferida. O comando compara o retrato e revisão mais recentes sob bloqueio do lote; registra histórico imutável e requestId idempotente. Reabertura inicia outro ciclo e não apaga histórico. Nenhum cadastro oficial é modificado; a aprovação continua bloqueada pelo 0831.

Esta etapa não é snapshot do cadastro oficial nem libera aplicação. Integração posterior deverá comparar o estado oficial completo, impedir caminhos legados que descartem campos e evitar sincronização externa; testar antes de liberar. Consulta/UI, testes e aplicação ainda pendentes.
