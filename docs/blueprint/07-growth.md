---
name: blueprint-growth
description: Requirements do módulo Growth (Meta Ads, Google Ads, atribuição de leads). Puxe ao planejar specs de aquisição paga.
alwaysApply: false
---

# Blueprint — Growth

> Schema Postgres: `growth` · Feature: `apps/web/src/features/growth/`

## Problema
A Sinérgica não sabia qual canal de mídia paga gerava leads qualificados nem o custo de aquisição
por cliente.

## Fluxos e regras de negócio

### Integração de anúncios
- Meta Ads API: importar campanhas, conjuntos, anúncios e métricas diárias.
- Google Ads API: idem.
- Frequência de sync: diária (cron).

### Atribuição de leads
- Lead chega via WhatsApp/formulário → vinculado à campanha/anúncio de origem (UTM ou Lead ID).
- Funil: impressão → clique → lead → qualificado → proposta → fechado.

### Dashboard de ROAS
- Custo por lead, custo por cliente fechado.
- ROAS por canal, campanha e período.

## Entidades
| Entidade | Descrição |
|----------|-----------|
| `MetricaCanal` | Impressões, cliques, custo, conversões por canal/campanha/dia |
| `LeadAds` | Lead gerado por anúncio com source e UTM |
| `Atribuicao` | Vínculo lead → campanha → proposta → contrato |

## Integrações (Mês 3+)
- Meta Ads API (Graph API)
- Google Ads API
- CRM Comercial (pipeline de leads)
