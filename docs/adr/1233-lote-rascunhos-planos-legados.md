# ADR-1233 — Lote transacional de rascunhos legados

## Decisão

Preparar comando privado para criar até 20 rascunhos de Planos legados do mesmo Cliente, reutilizando integralmente o comando individual do ADR-1064. Cada item contém seu próprio requestId, UUID da Rotina, fotografia e escolhas explícitas. O lote usa requestId separado, rejeita identidades duplicadas e processa Planos em ordem estável; erro de qualquer item reverte toda a transação. Um recibo imutável guarda entrada e resultados para repetição do mesmo lote, sem recriar efeitos.

## Limites

O lote só cria rascunhos; não aprova prévia, não prova equivalência e não migra ocorrências, Visitas, Chamados, OS ou dados financeiros. Não executa Auvo nem altera registros legados. A reversão continua individual e conservadora, não é rollback genérico de lote. Gate novo e comandos permanecem sem EXECUTE operacional. Antes de habilitar, implementar aceite de prévia e interface adequados, verificar limites e privacidade das fotografias, autorização/revogação, colisões, repetição, locks, rollback integral, FORCE RLS, concorrência e revisão adversarial. Nenhuma migração real é autorizada por este ADR.
