---
name: product
description: PRD-lite — Inbox multi-canal humano (Instagram/Messenger sem IA), tier Pequeno.
alwaysApply: false
---

# Product — Inbox Multi-canal Humano

> **Tier:** Pequeno · **Status:** aprovado · **Dono:** Codex
> Épica: E02 — Atendimento · Zé. Depende de `E02-S01`/`E02-S02`.

## Problema
O Inbox nasceu WhatsApp-only, mas o atendimento da Sinérgica precisa enxergar conversas de
Instagram e Messenger no mesmo painel humano. Ao mesmo tempo, a decisão de produto é clara: o Zé
não responde nesses canais nesta fase.

## Para quem
Fabrício e colaboradores do escritório com permissão no módulo `atendimento`.

## Goals
- Permitir `atendimento.conversas.canal` com `whatsapp`, `instagram` e `messenger`.
- Exibir o canal na lista/chat/dashboard sem tratar Instagram/Messenger como conversa do Zé.
- Bloquear ações de IA em canais não-WhatsApp.

## Non-goals
- Webhook/envio real via Meta Graph API.
- Templates oficiais WhatsApp/Meta.
- Agente de IA para Instagram/Messenger.

## Riscos / premissas
- Sem integração Meta real, conversas Instagram/Messenger só entram por import/manual/integração
  futura. Esta story prepara o modelo e a UX para não quebrar quando essas linhas existirem.
