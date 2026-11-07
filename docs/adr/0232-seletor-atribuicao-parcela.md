---
name: "docs-adr-0232-seletor-atribuicao-parcela-md"
description: "Documento Sinérgica SO: ADR-0232 — Seleção de OS para atribuição de parcela"
alwaysApply: false
---

# ADR-0232 — Seleção de OS para atribuição de parcela

## Decisão

Preparar consulta paginada de OS existentes do mesmo Chamado e Cliente da parcela, com estado, horário de atualização e revisões de Chamado/escopo para o comando 0456. Nenhuma OS é criada ou enviada. Comando revalida sob lock; consulta e escrita permanecem revogadas com flag desligada.

## Limites

Compatibilidade de tarefa, execução e interrupção não decorrem da seleção. `updated_at` depende da disciplina dos escritores legados, que deve ser auditada; realocação e concorrência precisam de revisão e testes. Sem aplicação.
