---
name: "docs-adr-0224-declaracao-interrupcao-parcela-md"
description: "Documento Sinérgica SO: ADR-0224 — Declaração rastreável de interrupção por parcela e OS"
alwaysApply: false
---

# ADR-0224 — Declaração rastreável de interrupção por parcela e OS

## Decisão

Preparar declaração explícita de PCM, versionada e auditada, sobre interrupção ou revogação da declaração para uma combinação parcela/OS do mesmo Chamado, somente durante suspensão administrativa registrada. Exigir vínculo prévio de Pendência à parcela, revisão de escopo/suspensão, capacidade atual e motivo. A declaração não altera OS, não envia ao Auvo e não encerra parcela.

## Limites

A declaração não comprova por si só que a OS recebeu aquela parcela ou parou em campo. O modelo não registra atribuição de todas as parcelas a todas as OS e o status Auvo não é prova suficiente. Portanto prévia deve continuar `nao_comprovada`, podendo exibir a declaração sem usá-la para autorizar devolução. Gate fechado e RPC revogada; sem teste/aplicação.
