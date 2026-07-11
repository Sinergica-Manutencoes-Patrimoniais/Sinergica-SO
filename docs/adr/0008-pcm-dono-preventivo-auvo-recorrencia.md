---
name: ADR-0008
description: PCM governa plano preventivo; Auvo materializa recorrência de campo.
alwaysApply: false
---

# ADR-0008 — PCM dono do preventivo; Auvo executor da recorrência

## Status

Aceita, com contrato de escrita pendente de validação viva.

## Contexto

O preventivo é uma decisão operacional e de conformidade do PCM. O Auvo já oferece service orders
recorrentes, mas o módulo está vazio na conta da Sinérgica; duplicar recorrência por cron no PCM
criaria duas fontes de verdade para datas e pausas.

## Decisão

O PCM mantém o plano e seu ciclo de vida; uma ativação materializa uma service order recorrente no
Auvo, identificada por `externalId` determinístico. O Auvo gera/executa tarefas; webhook e import
trazem as ocorrências de volta ao PCM.

## Consequências

- Evita cron caseiro para recorrência e preserva o app de campo como executor.
- Exige teste real de criação, pausa e correlação antes de ativar qualquer write path.
- Se o Auvo não preservar a chave de correlação na tarefa, esta decisão deve ser substituída por ADR
  novo; não se deve correlacionar por título ou data aproximada.
