---
name: adr-1678-ciclo-estavel-e-vencimento-original
description: Identidade estável de ocorrências contratuais e preservação do vencimento original.
alwaysApply: false
---

# ADR-1678 — Ciclo estável e vencimento original da ocorrência

## Estado

Proposta pendente de revisão arquitetural, execução integrada e homologação. Não autoriza deploy.

## Contexto

Alterações de calendário e execuções atrasadas não podem duplicar ocorrências nem deslocar silenciosamente vencimentos futuros. A ocorrência também precisa conservar a rotina e o alvo que a originaram.

## Decisão

Identificar cada ocorrência pela rotina lógica, alvo inequívoco e ciclo estável, independentemente da versão que materializou o ciclo. Persistir o vencimento original separadamente de eventual data programada; uma execução tardia não recalcula a base futura. Alterações de regra usam vigência/versionamento e materialização idempotente com decisão explícita para ciclos vencidos.

## Consequências

Chaves únicas e comandos transacionais devem impedir duplicação entre versões. Prévia e confirmação comparam a revisão esperada; exceções e tolerâncias são registradas sem apagar a data original. Datas e fusos precisam ser tratados explicitamente.

## Validação pendente

Revisão arquitetural; testes de recorrência, feriado, execução atrasada, troca de versão, idempotência e concorrência em banco isolado.
