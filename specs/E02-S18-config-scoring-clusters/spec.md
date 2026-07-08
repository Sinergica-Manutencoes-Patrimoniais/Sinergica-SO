---
name: spec
description: Contrato — abas "Scoring" (lead scoring por comportamento) e "Clusters" (regras de cluster), paridade heziomos.
alwaysApply: true
---

# Spec — Config de growth: Scoring + Clusters

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno-Médio
> Duas abas de growth do heziomos ausentes.

## Resumo
Adiciona a aba "Scoring" (regras de pontuação de lead por comportamento) e a aba "Clusters" (regras que
agrupam contatos em segmentos), configuráveis e aplicadas aos contatos/leads.

## Critérios de aceite

### AC-1: Regras de lead scoring
- **Dado** a aba Scoring
- **Quando** o usuário define regras (evento/comportamento → pontos) e limiares
- **Então** as regras persistem (RLS FORCE) e o score do contato é calculado a partir delas

### AC-2: Regras de cluster
- **Dado** a aba Clusters
- **Quando** o usuário cria/edita regras de agrupamento (critérios → cluster)
- **Então** as regras persistem e os contatos são classificados no cluster correspondente

### AC-3: Gating por papel
- **Dado** usuário sem permissão
- **Quando** acessa/edita
- **Então** é bloqueado (RLS + gate de UI)

## Casos de borda e erros
- Regra sem critério → validação impede salvar.
- Contato que casa múltiplos clusters → regra de precedência definida e documentada.
- Score sem regras → 0, não erro.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Opt-outs/automação IG — `E02-S17`. Base de contatos/relacionamento — já em `E02-S08`.

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `LeadScoringBehaviorTab`, `ClusterRulesTab`.
- Âncora Sinergica: `AtendimentoConfigPage.tsx`, schema `relacionamento` (E02-S08).
