---
name: "docs-adr-1200-impedimento-material-os-md"
description: "Documento Sinérgica SO: ADR-1200 — Impedimento de material na mesma OS"
alwaysApply: false
---

# ADR-1200 — Impedimento de material na mesma OS

## Contexto

Uma exceção de material pode exigir suspensão e posterior reprogramação da mesma OS. O histórico de exceções não equivale a uma suspensão, e suspender o Chamado inteiro não é equivalente a suspender uma OS.

## Decisão

Preparar histórico imutável de impedimento por OS, vinculado à exceção de material, com revisão, ator, motivo e requestId. Suspender e retomar são decisões distintas, serializadas por OS e com autorização atual; retomada referencia a mesma exceção que originou a suspensão. A operação não altera a OS legada ou seu identificador de tarefa Auvo.

## Limitações

Esta fundação registra intenção local e NÃO suspende a execução externa, cancela tarefa, reprograma Visita ou bloqueia todos os geradores. Gate fechado: não apresentar como suspensão operacional. Antes de liberar, integrar as transições reais e todos os consumidores, reconciliar efeitos externos em voo, validar concorrência, RLS/FORCE, permissões, idempotência e fazer revisão adversarial.
