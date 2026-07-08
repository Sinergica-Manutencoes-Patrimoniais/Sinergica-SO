---
name: spec
description: Contrato — painel operacional de Atendimento em paridade visual/funcional com o heziomos.
alwaysApply: true
---

# Spec — Painel operacional de Atendimento (paridade heziomos)

> **Fonte da verdade.** Status: rascunho · Tier: Médio
> Consome `E02-S10`. Reconstrói `AtendimentoDashboardPage` para ficar idêntico ao painel do heziomos
> (referência nos prints): KPIs de fila/SLA, saúde da fila, autonomia/escalonamento de IA, CSAT, mix
> de canal e seletor de período.

## Resumo
O painel de Atendimento passa a exibir o mesmo conjunto de widgets operacionais do heziomos, alimentado
pelo `SnapshotAtendimento` server-side, com seletor de período Hoje/7d/30d.

## Critérios de aceite

### AC-1: KPI strip de 6 cards
- **Dado** o snapshot do período selecionado
- **Quando** o painel carrega
- **Então** mostra: `Fila sem atendente`, `Conversas abertas`, `Não lidas`, `Mais antiga na fila`
  (duração), `1ª resposta (média)`, `Abertas hoje` (+ delta vs ontem) — como no heziomos `AtendimentoKpiStrip`

### AC-2: Saúde da fila (aging buckets)
- **Dado** conversas abertas não lidas
- **Quando** exibidas
- **Então** um card "Saúde da fila — tempo de espera" mostra as barras 0-1h / 1-4h / 4-24h / +24h com contagem

### AC-3: IA — autonomia e escalonamento
- **Dado** o mix de IA e os escalonamentos do período
- **Quando** exibido
- **Então** um card mostra donut IA conduzindo vs Humano, `Escalou para humano` (% + motivos),
  `IA no período` e `Resolvido pela IA (deflexão)` — como `AiHealthCard`

### AC-4: CSAT e Mix de canal
- **Dado** pesquisas e canais do período
- **Quando** exibidos
- **Então** há um card "Satisfação (CSAT)" e um "Mix de canal" com os valores do snapshot

### AC-5: Seletor de período
- **Dado** os botões Hoje / 7 dias / 30 dias
- **Quando** o usuário troca
- **Então** todos os widgets recomputam para a janela escolhida (via `E02-S10`)

## Casos de borda e erros
- Sem dados no período → widgets mostram estado vazio (zeros/"—"), não quebram.
- Snapshot ainda carregando → skeleton/placeholder, sem layout shift.
- Percentual nulo (sem base) → "—", nunca `NaN%`.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Widgets analíticos avançados (volume trend, SLA card, heatmap, throughput, carga por atendente) — `E02-S12`.
- Cálculo das métricas — vem pronto de `E02-S10`.
- Config do agente/canais — `E02-S13`+.

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `AtendimentoHome.tsx`, `AtendimentoKpiStrip`, `QueueHealthCard`, `AiHealthCard`,
  `CsatCard`, `ChannelMixCard`.
- Âncora Sinergica: `features/atendimento/pages/AtendimentoDashboardPage.tsx`.
