---
name: "docs-adr-0867-capacidade-leitura-agenda-tecnico-md"
description: "Documento Sinérgica SO: ADR 0867 — Contexto de agenda na capacidade"
alwaysApply: false
---

# ADR 0867 — Contexto de agenda na capacidade

## Contexto

`pcm.agenda_tecnico` registra alocações manuais por técnico, Cliente e dia. Não identifica atividade preventiva, esforço restante nem execução. A capacidade precisa mostrar esse contexto sem inferir disponibilidade ou consumir a mesma demanda duas vezes.

## Decisão

Expor leitura paginada por Cliente e semana da agenda existente, com gate novo desligado, autorização `capacidade.gerir` e execução como invoker para preservar as políticas RLS da própria agenda. A tela apresenta horários como contexto parcial, sem convertê-los em horas disponíveis nem descontá-los automaticamente.

## Limites

Sem horário completo, vínculo funcional, fuso e tratamento de sobreposição não se prova capacidade efetiva; dados de outros Clientes não são retornados. Ativar apenas após revisão adversarial, teste de papéis e carga. A migration adiciona objetos e uma leitura, sem alterar a agenda nem abrir gate. Retirar o endpoint e gate é reversível sem apagar dados da agenda; execução já realizada permanece em logs normais. Não autoriza deploy.
