---
name: spec
description: Critérios de aceite — colunas novas em ordens_servico e as 3 visões (Kanban, timeline, calendário) na tela de Ordens de Serviço.
alwaysApply: false
---

# Spec — Kanban/Timeline/Calendário de Ordens de Serviço

## AC — Schema

- AC-1: Dado o pull/webhook de uma tarefa Auvo, Quando `idUserTo`/`taskDate`/`checkInDate`/
  `checkOutDate`/`address` vêm no payload, Então `pcm.ordens_servico` grava
  `tecnico_auvo_user_id`/`data_agendada`/`check_in_at`/`check_out_at`/`endereco_visita`
  correspondentes (nulos quando ausentes no payload).
- AC-2: Dado `tecnico_auvo_user_id` presente, Quando existe `pcm.funcionarios` com esse
  `auvo_user_id`, Então `tecnico_funcionario_id` é preenchido; senão fica null (sem erro, sem
  bloquear a criação da OS — mesma tolerância já usada pra `client_id`).
- AC-3: OS criada manualmente (não vinda do Auvo) não é afetada — todas as colunas novas ficam
  null, comportamento atual preservado.

## AC — Kanban

- AC-4: Dado a aba Kanban, Quando abre, Então mostra uma coluna por status (`STATUS_OS`) com os
  cards das OS daquele status.
- AC-5: Dado um card, Quando o usuário muda seu status (arrastar ou ação equivalente), Então chama
  `alterarStatus` (já existente) e o card migra de coluna.

## AC — Timeline por técnico

- AC-6: Dado a aba Timeline, Quando abre, Então mostra uma linha por técnico com
  `tecnico_funcionario_id` resolvido, mais uma linha "Sem técnico" pras OS sem essa resolução.
- AC-7: Dado uma OS com `check_in_at`/`check_out_at`, Então a barra é posicionada nessa janela;
  sem check-in, usa `data_agendada` como fallback (ponto, não barra); sem nenhum dos dois, a OS não
  aparece na timeline (aparece nas outras abas normalmente).

## AC — Calendário

- AC-8: Dado a aba Calendário, Quando abre, Então mostra OS com `data_agendada` no dia
  correspondente (visão mês e semana); OS sem `data_agendada` não aparece aqui.

## Fora de escopo (ver `product.md`)

Mapa geográfico, produtos/serviços/assinatura/anexos, backfill retroativo das 2364 OS já
existentes, mover técnico via drag-and-drop na timeline.
