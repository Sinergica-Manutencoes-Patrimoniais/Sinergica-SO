---
name: "docs-adr-1242-interface-cancelamento-aceite-md"
description: "Documento Sinérgica SO: ADR-1242 — Interface do cancelamento de aceite"
alwaysApply: false
---

# ADR-1242 — Interface do cancelamento de aceite

## Decisão

Preparar interface para cancelar somente aceite confirmado, mediante motivo e confirmação. A tentativa de cancelamento é incorporada ao registro da aba, com requestId estável, e bloqueia nova criação enquanto estiver pendente. Consulta de recibo do lote continua disponível para verificar uma criação que venceu a corrida; nenhuma confirmação é presumida por ausência de resposta.

## Limites

O acesso autenticado depende das verificações e gates da função do ADR-1241, ainda desligados. Antes de habilitar, validar troca de sessão, armazenamento, perda de resposta, corrida entre criação e cancelamento, permissões/RLS, privacidade, acessibilidade e revisão adversarial. Não cancela nem reverte lote já criado.
