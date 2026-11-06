---
name: "docs-adr-0632-guarda-reconciliacao-material-md"
description: "Documento Sinérgica SO: ADR-0632 — Guarda conservadora de reconciliação"
alwaysApply: false
---

# ADR-0632 — Guarda conservadora de reconciliação

Gate desligado preserva caminho legado. Quando habilitado, novas candidaturas de material com qualquer decisão de reconciliação ficam bloqueadas, independentemente de seu teor: a revisão das origens não foi registrada em 0853 e uma declaração de fatos distintos não comprova exclusividade. Retry de comando já registrado delega ao caminho existente, sem criar novo item. Lock compartilhado da tabela de decisões serializa a verificação com inserções de decisões durante a transação, mas não protege todos os escritores financeiros nem invalida candidatos já criados.

Não ativar antes de testar migrações e concorrência, revisar impacto do lock amplo e ordem dos demais locks, transações em curso e todos os caminhos de criação/alteração de itens. Há pendência de versão de origem e reconciliação transversal; ausência de decisão não comprova exclusividade. A guarda não permite candidato de serviço extra nem libera faturamento automaticamente.
