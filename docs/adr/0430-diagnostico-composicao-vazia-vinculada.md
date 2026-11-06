---
name: "docs-adr-0430-diagnostico-composicao-vazia-vinculada-md"
description: "Documento Sinérgica SO: ADR-0430 — Diagnóstico de composição vazia vinculada"
alwaysApply: false
---

# ADR-0430 — Diagnóstico de composição vazia vinculada

Diagnóstico somente leitura lista composições vazias vinculadas a Chamado por Cliente e histórico auditado de retiradas conhecido. Não conclui causa quando não há registro, não encerra composição e não altera Chamado. Consultas exigem permissões existentes de validação e gestão de escopo, paginação e gate independente desligado. Antes de habilitar: revisão de autorização, concorrência, exposição das funções e testes.
