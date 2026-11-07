---
name: "docs-adr-0651-codigo-rascunho-sem-sync-md"
description: "Documento Sinérgica SO: ADR-0651 — Código de rascunho sem sincronização externa"
alwaysApply: false
---

# ADR-0651 — Código de rascunho sem sincronização externa

Status: proposta; gates fechados, não homologada.

O comando 0363 já permite edição sem alias apenas quando há ciclo de rascunho comprovado e nenhum marco de aprovação, sync, etiqueta, OS ou alias; preserva verificações de autorização, bloqueio e concorrência. Entretanto, seu UPDATE pode acionar o enfileiramento Auvo existente. O wrapper mantém essas verificações e ativa o GUC de supressão durante a chamada; não cria nem remove aliases. Não se presume que cadastros legados sejam rascunhos.

O novo gate e as RPCs permanecem fechados. A proteção é baseada em código estático: revisar todas as rotas e gatilhos e testar integração, falhas e retry antes de habilitar. Reconciliar eventual sincronização posteriormente por fluxo autorizado, nunca automaticamente nesta etapa.
