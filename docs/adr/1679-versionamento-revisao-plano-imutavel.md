---
name: adr-1679-versionamento-revisao-plano-imutavel
description: Versionamento imutável das revisões do Plano e preservação das execuções históricas.
alwaysApply: false
---

# ADR-1679 — Versionamento imutável de revisão do Plano

## Estado

Proposta pendente de revisão arquitetural, execução integrada e homologação. Não autoriza deploy.

## Contexto

Uma alteração aprovada no Plano não pode reescrever as Rotinas e o questionário que originaram execuções anteriores. O PCM precisa revisar escopos futuros sem apagar histórico ou produzir ordens de serviço automaticamente.

## Decisão

Tratar o Plano e suas Rotinas aprovadas como versões imutáveis. Alterações de escopo, regra ou data-base geram nova versão com vigência definida; snapshots usados por ocorrências existentes continuam consultáveis. A revisão não cria OS ou tarefas externas por si só.

## Consequências

Comandos de revisão comparam a versão esperada e registram autor, motivo e vigência. Retirada e suspensão afetam somente geração futura, preservando registros passados e encaminhando vencidos para decisão explícita do PCM.

## Validação pendente

Revisão arquitetural, testes de revisão concorrente, histórico imutável, retomada e garantia de ausência de efeitos externos não solicitados.
