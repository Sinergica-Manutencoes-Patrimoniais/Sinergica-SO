---
name: "docs-adr-1111-consulta-correlacao-gasto-md"
description: "Documento Sinérgica SO: ADR-1111 — Consulta de correlações declaradas de gasto"
alwaysApply: false
---

# ADR-1111 — Consulta de correlações declaradas de gasto

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar consulta paginada das correlações de aquisição e parcela vinculadas a uma lista, com autorização de custo e domínios envolvidos. Exibir somente identidades e revisões necessárias à conferência; não divulgar dados a outro Cliente nem modificar fontes ou orçamento. A consulta complementa, mas não substitui a validação transacional no comando de composição.

## Limites

Resultado paginado não é fotografia e ausência em páginas carregadas não comprova ausência de correlação. Não identifica gastos equivalentes não declarados ou resolve registros errados. Testar Cliente, revogação, paginação, RLS/FORCE, concorrência, privacidade e revisão adversarial antes de concessão e ativação.
