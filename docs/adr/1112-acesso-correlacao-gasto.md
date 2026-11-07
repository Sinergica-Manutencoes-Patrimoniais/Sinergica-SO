---
name: "docs-adr-1112-acesso-correlacao-gasto-md"
description: "Documento Sinérgica SO: ADR-1112 — Acesso à correlação declarada de gasto"
alwaysApply: false
---

# ADR-1112 — Acesso à correlação declarada de gasto

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar concessão autenticada para declaração e consulta das correlações. As funções mantêm gate fechado e exigem capacidades de orçamento, custos, materiais e despesa no Cliente; não se concede acesso às tabelas nem se ativa efeito financeiro.

## Limites

Antes da ativação, validar integralmente autorização, concorrência com composição e retificação, privacidade, RLS/FORCE e revisão adversarial. Declarações não cobrem gastos não correlacionados, fontes antigas ou correções de relação.
