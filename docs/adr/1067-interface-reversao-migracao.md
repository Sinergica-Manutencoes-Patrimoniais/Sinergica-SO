---
name: "docs-adr-1067-interface-reversao-migracao-md"
description: "Documento Sinérgica SO: ADR-1067 — Consulta e pedido de reversão de rascunho legado"
alwaysApply: false
---

# ADR-1067 — Consulta e pedido de reversão de rascunho legado

**Status:** preparado, não homologado. Complementa ADR-1066.

Uma consulta autenticada permite localizar a origem migrada e a revisão atual por Cliente e Plano. A interface solicita motivo e confirmação, mantém requestId e revisão em caso de resposta incerta e exibe o resultado sem apagamento. Gates de migração e reversão permanecem fechados; o gate independente de cobertura completa também permanece fechado, de modo que a avaliação atual só registra pendência.

Não é reversão integral de lote, comprovação de dependências ou aprovação operacional. Validar sessão/revogação, RLS/owner, concorrência, mudanças de origem, idempotência, exposição de motivo, retenção, acessibilidade e revisão adversarial antes de conceder uso; não abrir o gate de cobertura apenas para concluir a operação.
