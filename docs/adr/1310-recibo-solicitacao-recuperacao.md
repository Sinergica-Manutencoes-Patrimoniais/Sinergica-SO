---
name: "docs-adr-1310-recibo-solicitacao-recuperacao-md"
description: "Documento Sinérgica SO: ADR-1310 — Recibo de solicitação de recuperação"
alwaysApply: false
---

# ADR-1310 — Recibo de solicitação de recuperação

## Decisão

Consultar uma solicitação registrada pelo mesmo ator usando requestId e
payload exato, com autorização atual e vínculo ainda acessível ao Cliente.
A leitura usa a trava do request e não cria solicitação nem executa retry.
Recibo ausente não comprova falha; o pedido local deve permanecer preservado.

## Antes de habilitar

Validar autorização, revogação, transferência, exclusão, época/revisão,
concorrência com commit, normalização, RLS/FORCE e revisão adversarial.
Um recibo comprova somente o registro local, não o processamento externo.
