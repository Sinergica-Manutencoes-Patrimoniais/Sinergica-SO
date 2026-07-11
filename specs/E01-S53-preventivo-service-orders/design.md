---
name: design
description: Design — preventivo PCM→Auvo por recorrência nativa de service order.
alwaysApply: true
---

# Design — Preventivo recorrente: PCM dono, Auvo executor

## Decisão

Adotar o mecanismo A: uma recorrência nativa em `POST /serviceorders` por plano preventivo do PCM.
O módulo está vazio na conta, portanto não há legado operacional a preservar; a recorrência nativa
evita um cron paralelo que recriaria no PCM uma capacidade já oferecida pelo campo.

O PCM é dono do plano, da ativação, pausa e aderência. O Auvo recebe a recorrência e continua dono
somente das ocorrências de campo. A identificação será um `externalId` determinístico do plano.

## Contrato pendente de validação viva

O OpenAPI oficial confirma `GET/POST/PATCH /serviceorders`, filtros por `externalCode` e campos de
recorrência. A conta está vazia, mas ainda não foi possível criar uma ordem temporária para confirmar
os campos mínimos, a exclusão/pausa e a ligação entre service order e task gerada. Antes da migration
e do write path, executar esse teste contra um cliente autorizado e apagar a ordem de teste.

## Modelo proposto

`pcm.planos_preventivos` guardará cliente/equipamento opcional, tipo de tarefa, questionário,
responsável, periodicidade, horário, duração, status e `auvo_service_order_id`. A ocorrência que
chegar pelo webhook/import será ligada pelo `externalId` da recorrência; se o Auvo não reproduzir
essa chave na tarefa, a implementação para e registra `SPEC_DEVIATION` em vez de inferir por nome.

## Limites

- Pausar encerra a recorrência remota sem excluir OS históricas.
- Aderência é calculada no PCM por ocorrências finalizadas versus esperadas.
- PMOC legal continua sendo responsabilidade do submódulo PMOC; este plano só materializa execução.
