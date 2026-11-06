---
name: "docs-adr-1171-consulta-resposta-tardia-t24-md"
description: "Documento Sinérgica SO: ADR-1171 — Consulta de respostas tardias T−24"
alwaysApply: false
---

# ADR-1171 — Consulta de respostas tardias T−24

Status: proposta local, não aplicada nem homologada.

Permitir consulta paginada das observações tardias somente para a candidata, OS, Visita e Cliente informados, com autorização de Visita e reconciliação. A resposta é apenas observação; ID remoto não equivale a vínculo confirmado. Gate de consulta independente nasce fechado. A consulta não resolve ou altera candidato nem reenvia ao fornecedor.

Validar privilégio, revogação, mudança de titularidade, limites, paginação concorrente, privacidade, FORCE RLS e revisão adversarial antes de ativar. O registro de início ainda precisa ser integrado e validado.
