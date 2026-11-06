---
name: "docs-adr-1536-afirmacao-explicita-grupo-fila-md"
description: "Documento Sinérgica SO: ADR-1536 — Afirmação explícita para conferência de Grupo"
alwaysApply: false
---

# ADR-1536 — Afirmação explícita para conferência de Grupo

## Contexto
A declaração de fontes e motivo não expressava, no contrato, se o PCM afirmou não ter identificado execução nas fontes consultadas. Isso poderia ser interpretado como conclusão automática.

## Decisão
Novas declarações exigem afirmação explícita `true` em endpoint aditivo. A afirmação é auditada, vinculada ao mesmo request e afirma apenas o resultado da conferência humana nas fontes informadas; não garante cobertura externa. A função anterior aceita exclusivamente replay de pedidos já gravados, mantendo o recibo antigo. Para produzir elegibilidade na fila, declarações anteriores precisam de afirmação posterior explícita; sua fotografia original continua sujeita à revalidação. A nova chamada é idempotente e não altera fila ou OS.

## Limites
Não comprova ausência de execução em fontes externas nem substitui autorização e revisão. Validação de Visita, concorrência e revisão adversarial permanecem necessárias; gates permanecem desligados.
