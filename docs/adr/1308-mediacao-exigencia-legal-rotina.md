# ADR-1308 — Mediação da exigência legal da Rotina

## Decisão

Preparar entradas autenticadas para histórico e declaração de exigência,
hoje privados, com ator da sessão, trava de autorização e gate existente.
Delegar ao núcleo que verifica Cliente, revisão, rascunho, idempotência e
auditoria. A interface seleciona a nova entrada por flag desligada.

A declaração registra referência informada; não valida norma, tolerância
nem modifica snapshots já aprovados. Nenhuma publicação ou tarefa externa.

## Antes de habilitar

Validar autorização/revogação em ambas as ordens, transferência, revisão,
replay, paginação, snapshots, RLS/FORCE, compatibilidade e revisão adversarial.
Migração e cliente requerem implantação coordenada.
