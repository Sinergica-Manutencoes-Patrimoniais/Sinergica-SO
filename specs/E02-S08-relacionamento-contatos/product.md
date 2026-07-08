---
name: product
description: PRD-lite — Base única de contatos e timeline de relacionamento.
alwaysApply: false
---

# Product — Base Única de Contatos

> **Tier:** Arquitetural · **Status:** aprovado · **Dono:** Codex
> Épica: E02 — Atendimento · Zé. Pré-requisito para o agente comercial.

## Problema
O sistema já tem `pcm.clientes`, `comercial.leads` e `atendimento.conversas`, mas ainda não tem uma
entidade canônica para a pessoa por trás do telefone/e-mail/canal. Sem isso, o mesmo síndico,
zelador ou lead pode virar registros duplicados e o histórico fica espalhado.

## Para quem
Operação, atendimento e comercial, que precisam enxergar "quem é essa pessoa" antes de decidir se é
cliente existente, lead novo ou contato relacionado a um condomínio.

## Goals
- Criar uma base transversal de contatos e identidades de canal.
- Vincular conversa, lead e cliente a contatos sem fundir os domínios.
- Ter uma timeline agregada por contato para histórico de relacionamento.

## Non-goals
- Funil comercial completo.
- UI dedicada de CRM.
- Deduplicação automática agressiva entre contatos antigos.
- Substituir `pcm.clientes` como fonte de verdade de condomínios/clientes.

## Riscos / premissas
- Contato é pessoa/canal; cliente continua sendo entidade operacional do PCM.
- Um cliente pode ter vários contatos e um contato pode se relacionar a mais de uma entidade.
