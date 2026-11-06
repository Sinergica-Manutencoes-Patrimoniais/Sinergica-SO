---
name: "docs-adr-0250-atualizacao-grupo-levantamento-md"
description: "Documento Sinérgica SO: ADR-0250 — Atualização conferida de Grupo por levantamento"
alwaysApply: false
---

# ADR-0250 — Atualização conferida de Grupo por levantamento

## Decisão

Preparar atualização de Grupo existente no mesmo Cliente/Local, vinculada à linha aprovada, com revisão do lote e do Grupo, quantidade explícita da linha e características estruturadas fornecidas pelo PCM. O Grupo é bloqueado, campos anteriores são conferidos, identidade/código/local/categoria/Sistema são preservados, e nome, quantidade e características são auditados antes/depois. A decisão de incorporação é submetida à guarda de aprovação 0466. Nenhuma OS ou integração externa é criada.

## Limites

Não interpreta texto livre como características. Linhas com observação, código, classificação, referência de pai ou outros campos adicionais são recusadas para não descartá-los; requer evolução de mapeamento antes do rollout. Não grava código de Grupo (modelo ainda inexistente). Controle de revogação/concorrência, validação, efeitos de trigger e integração precisam de teste e revisão. Gate fechado/RPCs revogadas; sem aplicação.
