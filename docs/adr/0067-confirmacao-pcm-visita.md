# ADR-0067 — Confirmação PCM e snapshot de política

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

Confirmação PCM exige Visita planejada, responsável ativo, equipe ativa e OS vigentes, autorização atual e revisão esperada. Antes de confirmar, bloqueia escopos de política de Cliente, contrato (quando houver) e Visita, nessa ordem; então bloqueia a Visita e revalida o escopo. O comando grava snapshot imutável da política efetiva, revisão confirmada, ator, instante e auditoria na mesma transação idempotente. Alterações futuras de política não reescrevem o snapshot. A resolução deve ser revalidada pelo fluxo de envio.

Ciência obrigatória não impede confirmação PCM, mas permanece exigida antes de enviar (F07, ADR-0062). O comando não gera intenção nem tarefa externa. Testes de disputa em duas sessões, ciência recebida, alterações/reconfirmação, integração E01-S168, disponibilidade e interface são gates pendentes.
