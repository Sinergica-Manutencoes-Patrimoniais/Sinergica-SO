# ADR-1198 — Transição de Plano mediada

## Contexto

Suspensão, encerramento e retomada preparados reutilizam funções privadas 0416/0419, enquanto a tela as chama por usuário autenticado. Os comandos não conciliam geradores legados nem resolvem vencidos automaticamente.

## Decisão

Preparar entrada mediada comum que valide ator, Cliente, capacidade e gate, preserve a ordem de trava do request e do Plano e delegue à função privada apropriada. Preparar também acesso mediado ao histórico com trava compartilhada do Plano. A flag da interface permanece desligada. O resultado deve indicar Cliente e revisão esperados; replay continua nas funções existentes.

## Limitações

Não garante interrupção de geradores legados, cancelamento de OS ou decisão sobre todos os vencidos. Testar sequência de migrações, privilégios, RLS/FORCE, autorizações reais, concorrência, replay, histórico e reconciliação antes de aplicar, habilitar ou homologar.
