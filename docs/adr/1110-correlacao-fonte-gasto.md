---
name: "docs-adr-1110-correlacao-fonte-gasto-md"
description: "Documento Sinérgica SO: ADR-1110 — Correlação declarada de fonte de aquisição e parcela"
alwaysApply: false
---

# ADR-1110 — Correlação declarada de fonte de aquisição e parcela

Status: proposta local, não aplicada nem homologada.

## Decisão

Permitir que operador autorizado declare que uma fonte de aquisição e uma parcela de despesa de Visita representam o mesmo gasto, desde que os vínculos de Cliente, lista e OS sejam comprovados e o rateio esteja na revisão atual. Registrar identidade, revisões, motivo, ator e requestId em histórico imutável; não inferir relação por descrição ou valor. A composição mista deve recusar a seleção simultânea de uma correlação declarada, com trava comum à declaração.

## Limites

A correlação é uma declaração auditada, não prova física de duplicidade. Relações não declaradas e caminhos manuais antigos continuam sem cobertura; não altera orçamento já salvo ou cobranças. Antes de ativar, implementar consulta e correção auditada quando necessário e validar locks, concorrência, autorização, Cliente, RLS/FORCE, revisão de rateio e revisão adversarial. Nenhum efeito financeiro ou externo é autorizado.
