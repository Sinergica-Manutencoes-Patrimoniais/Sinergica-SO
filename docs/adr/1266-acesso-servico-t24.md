---
name: "docs-adr-1266-acesso-servico-t24-md"
description: "Documento Sinérgica SO: ADR-1266 — Acesso de serviço ao despacho T−24"
alwaysApply: false
---

# ADR-1266 — Acesso de serviço ao despacho T−24

**Status:** proposta local, não homologada.

Preparar permissões apenas para `service_role` nas funções T−24 já protegidas por gates. O registro de resultado de outbox, que não possui gate próprio, recebe entrada mediada com gate novo fechado; o núcleo continua privado. Nenhuma permissão é concedida a usuários autenticados ou anônimos. A composição de serviço passa a usar a entrada mediada.

Não aplicar ou abrir gates antes de validar privilégios, identidade de serviço, fences, outbox, resposta perdida/tardia, concorrência e revisão adversarial. Não registra endpoint, agenda nem envia tarefa ao Auvo.
