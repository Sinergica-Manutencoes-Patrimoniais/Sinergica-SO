---
name: "docs-adr-0140-marcos-observados-codigo-md"
description: "Documento Sinérgica SO: ADR-0140 — Marcos observados do código público"
alwaysApply: false
---

# ADR-0140 — Marcos observados do código público

## Contexto

O ciclo privado da ADR-0138 não representa automaticamente ativos legados. A edição de rascunho não pode depender da ausência de vínculos quando outros escritores criam OS ou sincronizam simultaneamente.

## Decisão

Preparar gatilhos internos para marcar, somente em ciclos explicitamente existentes, a primeira referência direta por OS e a primeira atribuição de identificador Auvo. Os marcos são monotônicos, transacionais e incrementam a revisão; o bloqueio global de códigos usa tentativa não bloqueante antes da linha de ciclo para evitar inversão de locks. O monitoramento possui gate privado desligado, sem acesso direto de cliente. Cadastros sem ciclo não são inferidos como rascunho.

## Limites

Não habilitar a edição de rascunho nem os gatilhos isoladamente: ainda faltam criação confiável de ciclo, integração de aprovação e emissão de etiqueta, referências indiretas, auditoria completa de escritores legados, tratamento da transição e validação de concorrência. Atribuição de ID externo é apenas evidência observável, não cobre todas as sincronizações nem suas tentativas. Migration não aplicada nem testada.
