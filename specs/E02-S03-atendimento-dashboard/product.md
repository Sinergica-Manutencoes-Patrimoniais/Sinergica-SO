---
name: product
description: PRD-lite — Dashboard de Atendimento (KPIs read-only), tier Pequeno.
alwaysApply: false
---

# Product — Dashboard de Atendimento

> **Tier:** Pequeno · **Status:** aprovado · **Dono:** Claude (sessão Lucas)
> Épica: E02 — Atendimento · Zé. Depende de `E02-S01`/`E02-S02` (schema + Inbox).

## Problema
Sem visão consolidada de volume/fila/autonomia da IA no Atendimento — só dá pra ver conversa por
conversa no Inbox.

## Para quem
Fabrício e colaboradores do escritório com permissão de leitura no módulo `atendimento`.

## Goals
- Painel só-leitura com KPIs (conversas abertas, não lidas, assumidas por humano, paradas há 24h+,
  autonomia da IA), mix de canais e tags mais usadas — mesmo espírito de `PcmDashboardPage`
  (cálculo client-side sobre dado real, sem mock).

## Non-goals
- Qualquer ação de escrita — 100% leitura.
- SLA/tempo de primeira resposta (exigiria instrumentar timestamp de primeira resposta por
  conversa — não existe hoje; considerar em iteração futura se o volume justificar).
- Gráficos de série temporal — cards simples primeiro, evoluir com dado real depois.

## Riscos / premissas
- Métricas ficam com pouco significado até haver volume real de conversas em produção (mesmo
  aviso do plano original da épica) — construído mesmo assim porque o cálculo é barato e a tela
  fica pronta pra quando o volume existir.
