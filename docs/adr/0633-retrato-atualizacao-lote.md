---
name: "docs-adr-0633-retrato-atualizacao-lote-md"
description: "Documento Sinérgica SO: ADR-0633 — Retrato da seleção para atualização em lote"
alwaysApply: false
---

# ADR-0633 — Retrato da seleção para atualização em lote

Status: proposta; gates fechados, não homologada.

A seleção registra revisão do lote, atributos da linha e campos conferidos vistos pelo PCM. Antes de executar, o wrapper compara todos os retratos e a revisão inicial sob bloqueio do lote; mudanças obrigam nova seleção. O comando existente preserva autorização, snapshots oficiais, revisão encadeada, atomicidade e retry. O retry é reconhecido antes de consultar o estado atual, sem contornar a conferência de identidade e payload do comando original.

Nome anterior da RPC torna-se interno e não recebe permissões. Atualizar UI e testar autorização, conflito de revisão, repetição e corrida antes de liberar. Sem aplicação nesta etapa.
