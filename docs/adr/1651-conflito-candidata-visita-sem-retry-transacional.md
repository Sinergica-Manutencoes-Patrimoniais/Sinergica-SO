---
name: "docs-adr-1651-conflito-candidata-visita-sem-retry-transacional-md"
description: "Documento Sinérgica SO: ADR-1651 — Conflito de candidata de Visita após revisão"
alwaysApply: false
---

# ADR-1651 — Conflito de candidata de Visita após revisão

## Decisão

A comparação da candidata de Visita aprovada pode detectar alteração de negócio antes de vincular a nova ocorrência. O trigger conservará essa proteção, mas informará `P0020/visita_candidata_alterada`, distinguindo-a de falha real de serialização `40001`. A substituição da definição existente deve falhar fechada se a guarda não for encontrada exatamente uma vez.

Nas interfaces de preparação individual e em lote, uma rejeição específica recebida na primeira tentativa permite nova conferência após verificar sessão e pedido local. Em repetição após resultado incerto, o pedido original permanece preservado. O lote continua transacional; esta decisão não autoriza geração, altera fotografias ou modifica filas.

## Limites

A migration e as interfaces exigem implantação coordenada: interface antiga conserva o pedido diante do novo código; interface nova mantém o pedido diante do código antigo. Compilação, RPC individual e lote, HTTP, repetição e concorrência ainda precisam ser validados; gates existentes continuam fechados. Sem integração Auvo ou alteração de histórico.
