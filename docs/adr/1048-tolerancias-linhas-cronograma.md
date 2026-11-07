---
name: "docs-adr-1048-tolerancias-linhas-cronograma-md"
description: "Documento Sinérgica SO: ADR-1048 — Consulta conjunta de tolerâncias do cronograma"
alwaysApply: false
---

# ADR-1048 — Consulta conjunta de tolerâncias do cronograma

**Status:** preparação privada, não homologada.

Para a conferência de até 25 linhas antes da incorporação em lote, consultar numa única chamada as tolerâncias dos mapeamentos selecionados, vinculadas à revisão do lote. Ausência de configuração significa zero antes e zero depois, identificada como padrão; isso não afirma conformidade legal. A função rejeita IDs repetidos, ausentes, pertencentes a outro lote ou não vigentes, preserva a autorização e os gates de cronograma e bloqueia o lote durante a leitura.

Usar gate e flag próprios desligados, sem conceder execução externa. A apresentação exige a revisão consultada, mas não substitui conferência da aprovação ou revalidação da escrita no servidor. Antes da liberação, validar locks e ordem entre gates, sessão, revogação, paginação, segurança das tolerâncias normativas, corrida com mapeamento/tolerância, RLS e revisão adversarial. Não criar Plano, OS ou tarefa pela consulta.
