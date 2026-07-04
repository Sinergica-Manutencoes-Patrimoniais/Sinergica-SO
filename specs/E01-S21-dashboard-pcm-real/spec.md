---
name: spec-E01-S21-dashboard-pcm-real
description: Contrato para substituir mocks do dashboard PCM por dados reais do alvo.
alwaysApply: false
story: E01-S21
epic: E01
title: Dashboard PCM com dados reais
owner: "@pm"
status: approved
tier: pequeno
created_at: 2026-07-04
---

# Spec — E01-S21 Dashboard PCM com Dados Reais

## Objetivo

Remover os dados mockados do dashboard interno do PCM e alimentar KPIs/listas com dados reais do
alvo já disponível: `pcm.ordens_servico` e `pcm.inspecoes`.

## Escopo

- Substituir KPIs fixos do dashboard PCM por métricas calculadas de OS e inspeções.
- Substituir “Ordens de Serviço Recentes” por últimas OS reais.
- Substituir “Top Backlog GUT” por OS abertas reais ordenadas por `score_pcm`.
- Manter os cards de módulos ainda não construídos como placeholders.

## Fora de Escopo

- Dashboard geral consolidado de todos os módulos.
- SLA real por contrato, pois ainda não existe data alvo/contrato no schema operacional.
- Técnicos em campo em tempo real, pois ainda não existe fonte de check-in/check-out própria no PCM.

## Critérios de Aceite

- **AC-1:** Dashboard PCM não usa arrays mockados para KPI/OS recentes/backlog.
- **AC-2:** KPIs do PCM são calculados de `pcm.ordens_servico` e `pcm.inspecoes`.
- **AC-3:** OS recentes vêm de `pcm.ordens_servico`.
- **AC-4:** Top Backlog GUT vem de OS abertas ordenadas por score.
- **AC-5:** Estados de carregamento/erro/vazio são tratados.

