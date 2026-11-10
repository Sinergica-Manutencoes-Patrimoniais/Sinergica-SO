---
name: "docs-adr-1418-origens-internas-reconciliacao-mediadas-md"
description: "Documento Sinérgica SO: ADR-1418 — Consulta mediada de origens internas"
alwaysApply: false
---

# ADR-1418 — Consulta mediada de origens internas

## Decisão

Preparar leitura paginada de vínculos Comercial e Financeiro por Cliente e ator autenticado, reutilizando as projeções mínimas existentes e suas permissões. Valores, custos e payloads não são retornados. Não altera objetos nem executa integração.

## Limites

Migration e tela não testadas ou aplicadas; gate fechado. Validar RLS/FORCE, revogação, paginação concorrente, isolamento de Clientes, privacidade, performance e revisão adversarial. Projeção é parcial e vínculo observado não significa reconciliação concluída.
