---
name: "docs-adr-1154-historico-origem-material-md"
description: "Documento Sinérgica SO: ADR-1154 — Histórico da origem de material na intenção"
alwaysApply: false
---

# ADR-1154 — Histórico da origem de material na intenção

Status: proposta local, não aplicada nem homologada.

Permitir consulta individual do vínculo auditável entre intenção e evento de material, com autorização de Visita e materiais para o mesmo Cliente e OS e gates de intenção fechados por padrão. A ausência de vínculo retorna apenas ausência; existência de vínculo não prova que a exceção está aberta ou que a OS foi reprogramada. A tela deve consultar sob demanda e rejeitar resultado de outra sessão ou intenção.

Validar isolamento entre Clientes, revogação, concorrência de mudança de OS, paginação dos consumidores, retenção, FORCE RLS e revisão adversarial antes de ativar. Não altera histórico nem executa qualquer operação externa.
