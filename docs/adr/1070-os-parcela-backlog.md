---
name: "docs-adr-1070-os-parcela-backlog-md"
description: "Documento Sinérgica SO: ADR-1070 — Criação de OS para parcela vinda do Backlog"
alwaysApply: false
---

# ADR-1070 — Criação de OS para parcela vinda do Backlog

**Status:** preparação não homologada. Complementa ADR-1068/1069.

Parcela com vínculo comprovado ao Backlog pode gerar OS em solicitação com sua descrição e atribuição exclusiva na mesma transação. Usa conversão com fotografia e o comando proprietário de atribuição de Backlog; erro reverte a operação. Compartilha namespace de idempotência com a modalidade direta. Não agenda técnico, envia ao Auvo, comprova execução ou resolve continuidade.

Consulta e comando têm gate próprio fechado, dependem dos demais gates e capacidades e são expostos à interface sob flag desligada. Validar vínculos e ciclos de Backlog, locks e concorrência entre modalidades, idempotência, triggers/efeitos indiretos, revogação, estados e revisão adversarial antes da habilitação. Não aplicar ou disparar tarefas reais sem autorização.
