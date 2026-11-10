---
name: "docs-adr-1102-quarentena-transferencia-os-md"
description: "Documento Sinérgica SO: ADR-1102 — Quarentena de observação de OS transferida"
alwaysApply: false
---

# ADR-1102 — Quarentena de observação de OS transferida

Status: proposta local, não aplicada nem homologada.

## Decisão

Quando a varredura encontrar OS cujo Cliente atual difere do Cliente associado à observação anterior, registrar conflito de propriedade em quarentena privada, com histórico imutável e sem mover ou expor automaticamente o histórico. A página pode continuar para outras OS. Repetição com a mesma combinação não gera novo evento; mudança posterior registra nova revisão. A observação anterior não é classificada como resolvida.

## Limites

Não decide a propriedade do histórico nem altera os Clientes, a OS, a fila ou o Auvo. Acesso e resolução auditada precisam de fluxo próprio e de autorização adequada. Testar mudanças concorrentes, repetição, isolamento entre Clientes, RLS/FORCE, retenção e revisão adversarial antes de abrir gates ou executar varredura.
