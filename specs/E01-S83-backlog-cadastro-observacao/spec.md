---
name: spec-E01-S83-backlog-cadastro-observacao
description: Contrato — Backlog como atividades sem data (sem OS), cadastráveis direto ou originadas de inspeção; + campo de observação (texto livre) na OS/backlog.
alwaysApply: true
tier: pequeno
---

# Spec — Backlog (cadastro direto + origem inspeção) + campo Observação

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16). "Backlog são atividades a serem feitas ainda sem
> data, por isso sem OS. Podem ser cadastradas diretamente ou originadas de uma inspeção."
> "Incluir um campo de observação, texto livre."

## Resumo
Formaliza o **Backlog** como fila de atividades **sem data e sem OS ainda**, que podem ser (a)
cadastradas diretamente na plataforma ou (b) originadas de um item de inspeção. Adiciona um **campo
de observação (texto livre)** na OS/item de backlog.

## Contexto atual (AS-IS)
- Backlog GUT já existe (`BacklogGutPage.tsx`, E01-S20) sobre `pcm.ordens_servico` com
  `status='solicitacao'`/priorização. Inspeções existem (E01-S19/S73).
- Ligação inspeção→backlog é um dos temas de E01-S90 (assessment) — aqui garantimos o **destino
  backlog** e o cadastro direto; o pipeline completo de inspeção é da S90.

## Critérios de aceite

### AC-1: Cadastro direto de item de backlog
- **Dado** um usuário com `pcm:escrita`
- **Quando** cria um item de backlog (título, cliente, descrição, G/U/T/D, observação) **sem data**
- **Então** o item é persistido como backlog (sem OS/sem agendamento), aparece na fila do Backlog GUT
  ordenado por prioridade, e **não** vira tarefa no Auvo enquanto for backlog.

### AC-2: Backlog não tem OS/data
- **Dado** um item em backlog
- **Quando** é listado
- **Então** ele é explicitamente distinto de uma OS agendada: sem data agendada, sem técnico, sem
  vínculo Auvo. Só ao ser **planejado/promovido** vira OS (reusa o fluxo "Planejar" de E01-S20).

### AC-3: Origem inspeção
- **Dado** um item de inspeção marcado para execução pela Sinérgica
- **Quando** é enviado ao backlog
- **Então** nasce um item de backlog com rastreio à inspeção de origem (a mecânica detalhada
  inspeção→Chamado→backlog é de E01-S90; aqui o backlog aceita e exibe a origem).

### AC-4: Campo Observação (texto livre)
- **Dado** o form de OS/backlog
- **Quando** o usuário preenche "Observação"
- **Então** o texto livre é salvo e exibido no detalhe da OS/item, editável por quem tem `pcm:escrita`.

## Fora de escopo (vinculante)
- Pipeline completo de inspeção→item→destino (E01-S90).
- Kanban de colunas customizáveis (E01-S84).
- Histórico/timeline de mudanças da observação (só o campo atual).

## Rastreabilidade
- `apps/web/src/features/pcm/pages/BacklogGutPage.tsx`, `NovaOrdemServicoModal.tsx`
- `apps/web/src/features/pcm/domain/ordens-servico.ts` (+ observação), `priorizacao-backlog.ts`
- Migration: coluna `observacao text` em `pcm.ordens_servico` (se não existir) + flag/estado de backlog
- Depende de E01-S82 (campo D) para a priorização do item de backlog
