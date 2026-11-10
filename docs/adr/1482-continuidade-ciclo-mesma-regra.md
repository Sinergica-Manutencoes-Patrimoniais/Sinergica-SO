---
name: "docs-adr-1482-continuidade-ciclo-mesma-regra-md"
description: "Documento Sinérgica SO: ADR-1482 — Decisão de revisão também para ciclos com regra igual"
alwaysApply: false
---

# ADR-1482 — Decisão de revisão também para ciclos com regra igual

## Contexto
A continuidade de calendário foi associada à aprovação para coincidências com regra diferente. A busca de ciclo canônico da mesma série também pode reutilizar ocorrência de versão anterior; sem verificação adicional, esse caminho contornaria a decisão da revisão.

## Decisão
Com o protocolo de continuidade habilitado, antes de registrar uso em versão diferente, o gerador exige selo da decisão de manter aprovado para aquela ocorrência, versão, Plano, Rotina lógica, alvo e vencimento. A verificação vale tanto para séries iguais como para séries alteradas. Uso dentro da versão original mantém comportamento atual. Com gate desligado, comportamento legado permanece. Transação reverte qualquer escrita anterior se o selo não existir.

## Limites
A aprovação continua bloqueada pela guarda independente de fontes. Testar regras iguais e diferentes, criação nova, revisões sucessivas, concorrência, replay e outras portas de geração antes de ativar. Sem deploy ou Auvo.
