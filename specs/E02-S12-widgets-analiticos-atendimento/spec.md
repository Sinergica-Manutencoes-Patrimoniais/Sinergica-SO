---
name: spec
description: Contrato — widgets analíticos avançados do painel de Atendimento (paridade heziomos).
alwaysApply: true
---

# Spec — Widgets analíticos avançados do painel

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Complementa `E02-S11` com os cards analíticos restantes do heziomos. Consome `E02-S10`.

## Resumo
O painel ganha os widgets de tendência e produtividade do heziomos: volume por dia, SLA & entrega, pico
por hora (heatmap), throughput e carga por atendente.

## Critérios de aceite

### AC-1: Volume por dia
- **Dado** o período selecionado
- **Quando** exibido
- **Então** um card mostra o volume de conversas/dia dentro da janela (série temporal)

### AC-2: SLA & entrega
- **Dado** as metas de SLA (FRT, entrega)
- **Quando** exibido
- **Então** um card mostra atingimento de SLA e status de entrega do período

### AC-3: Pico por hora (heatmap)
- **Dado** a distribuição horária das conversas
- **Quando** exibido
- **Então** um heatmap por hora/dia da semana mostra os picos

### AC-4: Throughput e carga por atendente
- **Dado** as conversas resolvidas e a distribuição por atendente
- **Quando** exibidos
- **Então** há um card de throughput e um de carga por atendente (conversas ativas por pessoa)

## Casos de borda e erros
- Período curto (Hoje) com poucos pontos → série ainda renderiza sem quebrar.
- Atendente sem conversas → aparece com zero, não some.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- KPIs/saúde/IA/CSAT do painel base — `E02-S11`.
- Novas métricas não presentes no snapshot de `E02-S10` (estender o snapshot se faltar dado é decisão consciente lá).

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `VolumeTrendCard`, `SlaDeliveryCard`, `HourlyHeatmapCard`, `ThroughputCard`, `ConversationLoadCard`.
- Âncora Sinergica: `features/atendimento/pages/AtendimentoDashboardPage.tsx`.
