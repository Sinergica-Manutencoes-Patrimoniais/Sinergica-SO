---
name: "docs-adr-1017-consulta-parcelas-orcamento-md"
description: "Documento Sinérgica SO: ADR-1017 — Consulta de parcelas para orçamento"
alwaysApply: false
---

# ADR-1017 — Consulta de parcelas para orçamento

Status: preparação privada, não homologada.

Preparar consulta paginada de parcelas do último rateio de despesas ativas que correspondam à OS e ao Cliente da lista de materiais. Exigir capacidades de orçamento, custo, material e despesa, identidade e gates sob trava; retornar a revisão de cada rateio, valor e indicação de base prevista ou realizada para conferência humana. Consulta não classifica a parcela como aquisição, não grava composição e não altera despesa.

A paginação não é snapshot; o comando 1167 revalida fontes e vínculos no salvamento. Sem fonte comprovada não permitir inferir cobertura total ou ausência de duplicidade entre registros distintos. Função privada e gate fechado. Validar custos, privacidade, filtros, paginação, concorrência, RLS/FORCE, desempenho, permissões e revisão adversarial antes de conceder acesso.
