---
name: spec-E01-S16-relacionamento-equipamento-auvo-pcm
description: Contrato da feature E01-S16 — relacionamento OS/PCM com equipamento Auvo sem duplicar dados do equipamento.
alwaysApply: false
---

# Spec — E01-S16 Relacionamento Equipamento Auvo ↔ PCM

> Status: aprovado para implementação nesta sessão (2026-07-04).
> Decisão de produto já tomada: **Auvo continua dono dos dados de equipamento**. O PCM não duplica
> identificador, categoria, garantia ou ficha técnica em `pcm.equipamentos_cache`.

## Resumo
O PCM passa a guardar apenas o relacionamento entre entidades PCM e equipamentos do Auvo, começando
por OS ↔ `auvo_equipment_id`. Dados intrínsecos do equipamento seguem no Auvo; o cache local continua
mínimo e read-only.

## Critérios de aceite

### AC-1: PCM não adiciona atributos duplicados ao cache de equipamentos
- **Dado** a decisão de 2026-07-04
- **Quando** a story é implementada
- **Então** `pcm.equipamentos_cache` não recebe colunas de identificador, categoria, garantia ou
  ficha técnica do equipamento.

### AC-2: Relacionamento OS ↔ equipamento Auvo é persistido quando o payload trouxer equipamento
- **Dado** um webhook de Task com `auvo_task_id` conhecido e um `equipmentId`/campo equivalente
- **Quando** o webhook é processado
- **Então** o PCM faz upsert em `pcm.os_equipamentos_auvo` com `ordem_servico_id` e
  `auvo_equipment_id`.

### AC-3: Ausência de equipamento no payload não quebra a OS
- **Dado** um webhook sem equipamento
- **Quando** `pcm-auvo-webhook` processa o evento
- **Então** a transição de status e o snapshot rico seguem normalmente; nenhum relacionamento é
  criado.

### AC-4: Visão 360 usa a coluna real `auvo_customer_id` do cache E01-S11
- **Dado** `pcm.equipamentos_cache` já existe com `auvo_customer_id`
- **Quando** a Visão 360 lista equipamentos do cliente
- **Então** a consulta filtra por `auvo_customer_id = cliente.auvo_id` e não por coluna inexistente.

## Fora de escopo
- Duplicar atributos de equipamento no PCM.
- Criar tela de prontuário de ativo/equipamento.
- Resolver PMOC/ativos próprios do PCM.

## Rastreabilidade
- Estende: `../E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md`
- Consumidor existente: `../E01-S12-visao-360-cliente/spec.md`
