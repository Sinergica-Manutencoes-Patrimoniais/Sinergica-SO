---
name: "docs-adr-1167-recibo-cancelamento-t24-md"
description: "Documento Sinérgica SO: ADR-1167 — Recuperação de cancelamento T−24"
alwaysApply: false
---

# ADR-1167 — Recuperação de cancelamento T−24

Status: proposta local, não aplicada nem homologada.

Disponibilizar consulta do recibo de cancelamento ao mesmo ator, mediante autorização atual e comparação integral do pedido, Cliente, Visita, OS, candidata, fence e motivo. A consulta não repete a operação e não prova estado remoto; ausência ou divergência não é interpretada como falha segura para novo envio. A tela mantém tentativa até receber recibo compatível e conferir sessão após reconsulta.

Validar isolamento, revogação, concorrência, transferência de Cliente, privacidade do motivo, RLS/FORCE e revisão adversarial. Gate permanece fechado.
