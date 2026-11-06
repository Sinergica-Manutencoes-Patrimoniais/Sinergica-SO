---
name: "docs-adr-0597-busca-codigo-falha-fechada-md"
description: "Documento Sinérgica SO: ADR-0597 — Busca de código com autorização fechada"
alwaysApply: false
---

# ADR-0597 — Busca de código com autorização fechada

Status: proposta, não homologada.

A busca existente 0329 já procura código atual e alias exatos, deduplica o mesmo ativo e indica ambiguidade sem expor dados de outro Cliente. A expressão de autorização usava `not`, que não rejeita resultado SQL nulo; porém, a implementação vigente da autorização em 0246 usa `coalesce(exists(...), false)` e não retorna nulo. Portanto, não há bypass demonstrado: esta alteração é defesa contra uma futura mudança desse contrato. A substituição preserva assinatura, concessões e busca exata, exigindo usuário, Cliente e autorização explicitamente verdadeira. As junções e filtros continuam restritos ao Cliente solicitado. Não cria busca global, nem normaliza códigos legados.

Revisar grants, RLS, cenários de autorização nula e colisões cross-Cliente em testes antes da aplicação. Interface existente continua protegida por sua flag; esta migration corrige a RPC existente independentemente da flag. Não aplicada nesta etapa.
