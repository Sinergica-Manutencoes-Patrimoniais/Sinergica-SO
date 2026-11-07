---
name: "docs-adr-0108-levantamento-conferencia-anotacoes-md"
description: "Documento Sinérgica SO: ADR-0108 — Anotações de conferência em staging de levantamento"
alwaysApply: false
---

# ADR-0108 — Anotações de conferência em staging de levantamento

## Estado

Proposta local, não homologada. Não aplicar ou ativar até testes de autorização, concorrência e integração.

## Decisão

Permitir registro append-only de observação de conferência por linha e revisão do lote, sem alterar atributos recebidos, aprovar linha, reservar código ou escrever na estrutura oficial. PCM autorizado por `cadastro.aprovar` registra observação identificada por requestId; Cliente deriva do lote. Repetição idêntica só retorna resultado após nova autorização, payload divergente conflita, e revisão obsoleta falha. O lote é bloqueado e incrementado na mesma transação que a observação, resultado e evento auditável. Leitura das observações exige autorização atual e escopo do lote.

## Limites e gates

Anotação não comprova localização, classificação, vínculo ou duplicidade. Aprovação parcial e incorporação dependem dos contratos oficiais E01-S176/S177, preservação de referências, fotos e reserva de código; continuam bloqueadas. Validar ordem de locks e revogação concorrente com E01-S170, duas sessões, idempotência, RLS, proteção de dados de campo, paginação e revisão adversarial antes de ativar. A tela permanece sob flag desativada e a 0327 não foi aplicada.
