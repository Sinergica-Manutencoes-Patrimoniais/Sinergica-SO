---
name: "docs-adr-1494-origem-servidor-ciclo-individual-md"
description: "Documento Sinérgica SO: ADR-1494 — Conferência da origem no ciclo individual"
alwaysApply: false
---

# ADR-1494 — Conferência da origem no ciclo individual

## Contexto
O lote reconfere a origem efetiva no servidor, mas a chamada individual de materialização canônica era acessível por RPC sem essa conferência integral. A interface não é uma barreira contra chamadas concorrentes ou diretas.

## Decisão
Sob o mesmo gate de origem do lote e protocolo de concorrência, a materialização individual consulta a origem efetiva após validar a revisão e antes de criar ou reutilizar uma ocorrência. Origem diferente de Plano, conflito ou vínculo PMOC histórico impede nova execução. O replay de um comando já concluído mantém o recibo anterior. O lote usa a mesma guarda e continua transacional.

## Limites
A consulta reconhece vínculos PMOC registrados, não comprova exclusividade de todos os agendamentos. Gate permanece desligado; testar chamadas diretas, replay, conflitos, concorrência e rollback antes de habilitar. A guarda 1045 e homologação permanecem bloqueadas; sem chamadas reais ao Auvo.
