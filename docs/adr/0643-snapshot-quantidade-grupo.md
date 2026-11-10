---
name: "docs-adr-0643-snapshot-quantidade-grupo-md"
description: "Documento Sinérgica SO: ADR-0643 — Quantidade de Grupo congelada na aprovação"
alwaysApply: false
---

# ADR-0643 — Quantidade de Grupo congelada na aprovação

Sob gate desligado, nova aprovação captura quantidade e revisão dos Grupos ativos do mesmo Cliente por Rotina, em texto dentro do snapshot da versão. Planos sem alvo Grupo recebem lista vazia; versões já aprovadas não são alteradas. Os Grupos são lidos com bloqueio compartilhado em ordem determinística durante a aprovação.

O dado é fotografia na aprovação, não prova quantidade no início futuro da vigência ou execução. A ocorrência 0815 ainda fotografa o cadastro no seu registro; integração entre esses dois marcos e tratamento de mudança posterior permanecem pendentes. Ordem geral de locks, segurança, testes e homologação são obrigatórios antes de ativação; nenhum gate ou permissão é concedido.
