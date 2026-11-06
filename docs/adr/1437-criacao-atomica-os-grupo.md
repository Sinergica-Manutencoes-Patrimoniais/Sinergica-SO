---
name: "docs-adr-1437-criacao-atomica-os-grupo-md"
description: "Documento Sinérgica SO: ADR 1437 — Criação de OS para Grupo Quantitativo"
alwaysApply: false
---

# ADR 1437 — Criação de OS para Grupo Quantitativo

Uma intenção existente pode originar uma OS preventiva local, decisão e vínculo em transação única, preservando fotografia da rotina e quantidade histórica. A chave de pedido permite repetição da mesma operação e a ocorrência serializa criações concorrentes. A operação depende de permissões e gates existentes; o gate de criação permanece desligado.

A rotina não solicita tarefa Auvo, usa a proteção transacional de sincronização existente durante a escrita e recusa execução se o antigo disparador automático conhecido estiver ativo. A integração completa, demais disparadores, concorrência, autenticação, supressão por feriado, consumidores, replay e isolamento devem ser validados e passar por revisão adversarial antes de homologação ou ativação.
