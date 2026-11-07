---
name: "docs-adr-0079-retirada-rotina-rascunho-md"
description: "Documento Sinérgica SO: ADR-0079 — Retirada de Rotina da revisão em rascunho"
alwaysApply: false
---

# ADR-0079 — Retirada de Rotina da revisão em rascunho

## Decisão

Permitir retirar somente uma linha pertencente à versão em rascunho de Plano editável, mediante autorização atual, revisão, motivo, auditoria e pedido idempotente. A linha do rascunho é removida transacionalmente e sua imagem integral e motivo são preservados na auditoria. Versões aprovadas e seus snapshots nunca são alterados; a comparação identifica a identidade lógica retirada. A operação não cancela Ocorrências nem altera OS e não autoriza aprovação futura.

## Limites e reversão

Como a linha do rascunho é removida, restauração requer ação explícita a partir da auditoria ou reconstrução do snapshot; não há restauração automática. Após adoção de novos vínculos à linha, FKs devem impedir remoção até existir fluxo seguro de impacto. Desativar o comando antes de reverter a migration e manter auditoria. Testar concorrência, integração e revisão adversarial antes de PASS.
