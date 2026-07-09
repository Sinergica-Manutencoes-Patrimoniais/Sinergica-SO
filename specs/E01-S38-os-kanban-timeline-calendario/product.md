---
name: product
description: Motivação e escopo — Kanban, timeline por técnico e calendário para gestão de Ordens de Serviço, com dado real de técnico/data/check-in vindo do Auvo.
alwaysApply: false
---

# Product — Kanban/Timeline/Calendário de Ordens de Serviço

## Motivação

Depois do backfill real (E01-S34), o PCM tem 2364 Ordens de Serviço reais vindas do Auvo — volume
suficiente pra gestão operacional de verdade, não só uma lista. Lucas pediu (2026-07-09) evolução
da tela "Ordens de Serviço" pra 3 visões de gestão: Kanban (fluxo por status), timeline por técnico
(carga de trabalho por pessoa) e calendário (agenda de visitas).

## Escopo

- Nova aba **Kanban**: coluna por status, mudança de status por arrastar (ou clique, se drag-and-drop
  não couber no tier), reaproveitando `alterarStatus` já existente.
- Nova aba **Timeline por técnico**: uma linha por técnico, barras posicionadas pela janela real de
  execução (check-in/check-out, ou data agendada como fallback).
- Nova aba **Calendário**: visão mês/semana com OS posicionada na data agendada.
- Pré-requisito de dado: `pcm.ordens_servico` ganha `tecnico_auvo_user_id`,
  `tecnico_funcionario_id`, `data_agendada`, `check_in_at`, `check_out_at`, `endereco_visita` —
  hoje descartados no pull/webhook de tarefa (ver `design.md`).

## Fora de escopo

- Mapa geográfico, produtos/serviços/assinatura/anexos da tarefa (ver `design.md` → Non-goals).
- Backfill retroativo das 2364 OS já existentes (rodaria um script pontual depois, não bloqueia).
- Drag-and-drop entre técnicos na timeline (mover OS de técnico é uma feature de escrita separada).
