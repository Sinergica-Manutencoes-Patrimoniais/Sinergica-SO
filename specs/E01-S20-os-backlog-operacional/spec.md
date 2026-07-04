---
name: spec-E01-S20-os-backlog-operacional
description: Contrato das telas reais de Ordens de Serviço e Backlog GUT no PCM.
alwaysApply: false
story: E01-S20
epic: E01
title: Ordens de Serviço e Backlog GUT operacionais
owner: "@pm"
status: approved
tier: pequeno
created_at: 2026-07-04
---

# Spec — E01-S20 Ordens de Serviço e Backlog GUT Operacionais

## Objetivo

Transformar os itens de navegação `Ordens de Serviço` e `Backlog GUT` do PCM em telas reais,
usando `pcm.ordens_servico` como fonte de verdade e o domínio de priorização GUT já existente.

## Escopo

- Listar OS reais com cliente, número, título, categoria, status, prioridade, origem, GUT e sync Auvo.
- Exibir detalhe da OS selecionada.
- Permitir alteração controlada de status por usuário com escrita PCM.
- Exibir Backlog GUT real: OS em aberto, ordenadas por `score_pcm desc`.
- Permitir planejar uma OS do Backlog, mudando status para `planejamento`.
- Reaproveitar o modal `Nova OS` já criado em E01-S18.
- Criar migration de banco para registrar eventos de mudança de status da OS.

## Fora de Escopo

- Novo schema/tabela do Hub de OS (E01-S07 continua arquitetural futuro).
- Drag-and-drop kanban.
- Despacho técnico completo.
- Histórico de comentários.
- Regras complexas de transição de estado.

## Critérios de Aceite

- **AC-1:** Usuário com leitura PCM vê a aba `Ordens de Serviço` com dados reais de `pcm.ordens_servico`.
- **AC-2:** Usuário com leitura PCM vê a aba `Backlog GUT` com OS em aberto ordenadas por score.
- **AC-3:** Usuário com escrita PCM consegue alterar status de uma OS.
- **AC-4:** Usuário com escrita PCM consegue planejar uma OS a partir do Backlog.
- **AC-5:** Usuário sem escrita PCM não vê comandos de alteração de status.
- **AC-6:** A tela não inventa dados Auvo; mostra apenas `auvo_task_id`, `auvo_sync_status` e erro quando existirem.
- **AC-7:** Mudanças de status geram evento append-only em `pcm.os_status_eventos`.
