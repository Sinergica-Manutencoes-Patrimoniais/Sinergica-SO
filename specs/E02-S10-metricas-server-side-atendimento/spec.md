---
name: spec
description: Contrato — métricas de Atendimento computadas server-side (edge function) com janelas de período.
alwaysApply: true
---

# Spec — Métricas server-side de Atendimento

> **Fonte da verdade.** Status: rascunho · Tier: Arquitetural (nova Edge Function + agregação)
> Fundação do painel de paridade com o heziomos. O painel atual computa KPIs no cliente sobre a lista
> de conversas (limitada pelo cap de 1000 linhas do PostgREST) — não escala nem calcula SLA/deflexão.

## Resumo
Uma Edge Function `atendimento-metrics` computa um `SnapshotAtendimento` server-side (fila, abertas,
não lidas, FRT, oldest-wait, autonomia, aging buckets, mix de canal, mix IA, escalonamento, deflexão,
CSAT) mais séries por período (Hoje/7d/30d), consumido pelo painel via um único gateway.

## Critérios de aceite

### AC-1: Snapshot operacional completo
- **Dado** conversas/mensagens de atendimento
- **Quando** `atendimento-metrics` é invocada com um período
- **Então** retorna `SnapshotAtendimento` com: `filaSemAtendente`, `abertas`, `naoLidas`,
  `maisAntigaNaFilaMs`, `frtMedioSegundos`, `abertasHoje` (+ delta vs ontem), `autonomiaPct`,
  `aging` (buckets 0-1h/1-4h/4-24h/+24h), `mixCanal`, `mixIa` (IA/Humano/Pausado),
  `escalonamento` (total + motivos), `deflexaoPct`, `csat`

### AC-2: Agregação server-side ignora o cap de 1000 linhas
- **Dado** mais de 1000 conversas no período
- **Quando** o snapshot é computado
- **Então** os números refletem **todas** as conversas do período (agregação em SQL/edge, não fatiada
  pelo default do PostgREST)

### AC-3: Janelas de período
- **Dado** o seletor Hoje/7d/30d
- **Quando** o período muda
- **Então** a function recomputa para a janela pedida; séries temporais (volume/dia, atividade IA)
  vêm agrupadas por dia dentro da janela

### AC-4: Cálculo puro e testável
- **Dado** a lógica de derivação dos KPIs
- **Quando** testada
- **Então** existe uma função pura (`computarSnapshot`) isolada de I/O, coberta por testes de unidade
  com datasets sintéticos (mesma separação domínio/infra do resto do módulo)

## Casos de borda e erros
- Período sem conversas → snapshot com zeros/nulos, não erro.
- Conversa sem mensagem de saída → não conta em FRT nem em mix IA.
- Divisão por zero em percentuais (autonomia, deflexão, CSAT) → retorna `null`/0 documentado, não `NaN`.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- A UI do painel — `E02-S11` (e widgets avançados `E02-S12`).
- Escrita/config de qualquer coisa — é read-only de métricas.

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md` (a criar)
- Referência heziomos: `features/crm/lib/atendimento-metrics.ts` (`computeSnapshot`),
  `hooks/use-atendimento-metrics.ts`, edge `crm-atendimento-metrics`.
- Âncora Sinergica: `features/atendimento/domain/dashboard-atendimento.ts`,
  `application/dashboard-atendimento-gateway.ts`.
