---
name: "docs-adr-0207-transferencia-visita-confirmada-sem-envio-md"
description: "Documento Sinérgica SO: ADR-0207 — Transferência protegida antes de efeito remoto"
alwaysApply: false
---

# ADR-0207 — Transferência protegida antes de efeito remoto

Status: proposta, não homologada.

Além da transferência entre Visitas não confirmadas, comando preparado admite origem/destino confirmados somente se OS envolvida não tiver tarefa ou estado de integração conhecido e nenhuma Visita estiver enviada/em execução. Fecha vínculo anterior, cria vínculo novo com motivo, preserva esforço declarado e atualiza revisões; Visita confirmada volta a planejada, exigindo nova confirmação. Não altera regra contratual nem agenda Auvo. Visitas extras já são criadas como `extra` pelo fluxo existente sem alterar regra semanal.

Gate/RPC permanecem fechados. Estado nulo não é prova suficiente de ausência de efeito remoto incerto; coordenação com S168, revisão de conflitos, confirmação e outros escritores, testes e revisão adversarial continuam obrigatórios. OS já enviada não é transferida por este comando.
