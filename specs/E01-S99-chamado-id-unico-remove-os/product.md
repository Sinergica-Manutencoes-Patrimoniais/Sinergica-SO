---
name: product
description: PRD-lite da feature (por quê e para quem). Puxe ao abrir feature pequena/arquitetural.
alwaysApply: false
---

# Product — Chamado como ID único (remover numeração própria de OS)

> **Tier:** arquitetural · **Status:** rascunho · **Dono:** Lucas / @architect

## Problema
Hoje existem **dois números** para a mesma jornada de trabalho: o Chamado (`CH-XXXX`) e a Ordem de
Serviço (`OS-XXXX`, gerada pela sequence `pcm.fn_proximo_numero_os` introduzida em E01-S88). Na
reunião de 2026-07-27, o Fabrício deixou claro que a OS **não deve ter um ID próprio**: o Chamado é
o identificador de ponta a ponta, e "virar OS" é apenas uma fase do mesmo Chamado (definida por ter
data + técnico). Dois números geram confusão operacional e rastreio dividido entre PCM e Auvo.

## Para quem
Operação da Sinérgica (Fabrício, Aline, supervisores) que rastreia a jornada
solicitação → tratamento → execução. Todo Chamado que vira execução hoje ganha um segundo número.

## Resultado esperado / métrica de sucesso
- Métrica: número de identificadores por jornada de trabalho.
- Baseline: 2 (`CH-XXXX` + `OS-XXXX`) → Alvo: **1** (`CH-XXXX` ponta a ponta).
- No Auvo, a task carrega o `CH-XXXX` no campo **código externo**, fechando o elo de rastreio.

## Goals
- `CH-XXXX` é o único identificador humano da jornada no PCM.
- "Virou OS" é representado por flag/estado do Chamado, não por nova numeração.
- Task do Auvo recebe `CH-XXXX` como código externo.
- Reverter a numeração `OS-XXXX` introduzida em E01-S88 de forma consciente e registrada (ADR).

## Non-goals
- Remover a **entidade** `pcm.ordens_servico` (ela continua existindo como estado/execução com seu
  UUID interno; o que sai é o **número humano `OS-XXXX`**).
- Mudar o fluxo de Kanban/Hub de OS além do necessário para a numeração.
- Alterar a medição de SLA (é E01-S100/S101).

## Riscos / premissas
- **Premissa:** as migrations de E01-S88 (`fn_proximo_numero_os`) **ainda não rodaram em produção**
  (ver ROADMAP) — se já rodaram, a reversão exige plano de dados para OS já numeradas.
- **Risco:** OS importada do Auvo sem Chamado de origem (task criada direto no Auvo) — precisa de
  regra para o identificador. Ver `design.md` (questão em aberto).
- Reverter decisão registrada em E01-S88 exige ADR que a substitua (não editar o histórico).
