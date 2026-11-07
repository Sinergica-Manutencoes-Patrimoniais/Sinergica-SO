---
name: "docs-adr-1476-fotografia-impacto-grupo-revisao-md"
description: "Documento Sinérgica SO: ADR-1476 — Fotografia de efeitos de Grupo nas decisões de revisão"
alwaysApply: false
---

# ADR-1476 — Fotografia de efeitos de Grupo nas decisões de revisão

## Contexto
As decisões S165 fotografam ocorrências S166 e OS alcançadas pela ponte legada. Efeitos de Grupo Quantitativo, vínculos explícitos e Chamados por ciclo também podem preservar trabalho executado e não aparecem nessa fotografia.

## Decisão
Ao registrar decisão mediada, guardar complemento imutável vinculado ao mesmo requestId e à mesma transação, com Grupo e referências de execução observadas, inclusive vínculos explícitos, intenções, evidências e Chamados por ciclo. Reavaliar a última decisão contra as fontes atuais e informar decisões ausentes ou desatualizadas. Serializar a captura e avaliação com os escritores dessas fontes por locks de tabela SHARE NOWAIT; falhar e repetir sob concorrência, sem esperar indefinidamente. Esta proteção é global e pode causar contenção; gates permanecem fechados até medir carga e revisar ordem de locks. Requests antigos sem complemento precisam de nova decisão; não fabricar fotografia retroativa. Histórico, OS e ocorrências não são alterados.

## Limites
Essas fontes não provam universo completo ou equivalência de legado/PMOC. O complemento ainda não autoriza aprovação nem modifica o gerador. Validar transações, replay, Cliente, permissões, todas as fontes, contenção e corrida nas duas ordens; revisar segurança e rollout antes de habilitar.
