---
name: product-0001-priorizacao-backlog-gut
description: PRD-lite da priorização de backlog por GUT — por quê e para quem. Puxe ao revisar escopo desta feature.
alwaysApply: false
---

# Product — Priorização de Backlog por Matriz GUT

> Tier: pequeno · Status: implementado · Dono: @pm

## Problema
A Sinérgica acumula dezenas de itens de manutenção pendentes por condomínio, mas sem critério
objetivo de priorização — a decisão de "o que fazer primeiro" era inteiramente subjetiva e
dependia da memória do gestor. Isso causava itens críticos esquecidos e urgências mal calibradas.

**Evidência:** no PCM v2 (legado), a coluna `score_pcm` era calculada por trigger no banco
mas nunca exposta de forma navegável; o backlog era ordenado por data de criação.

## Para quem
- **Gestor / Escritório** — quem agenda visitas e decide o que entrar no plano da semana.
- **Fabrício (dono)** — quer visibilidade do estado real do backlog por condomínio.

## Resultado esperado / métrica de sucesso
- **Métrica**: % de OS corretivas abertas que vieram dos top-3 do backlog GUT (indicador de aderência à priorização).
- **Baseline**: 0% (nenhuma priorização formal hoje).
- **Alvo**: ≥80% das OS corretivas originadas de itens com score GUT alto/crítico.

## Goals
- Calcular score GUT (gravidade × urgência × tendência, 1–5 cada) de forma confiável e testável.
- Classificar itens em faixas (crítica/alta/média/baixa) derivadas do score.
- Ordenar o backlog por score desc de forma estável (sem embaralhar empates).

## Non-goals
- Interface de usuário (só lógica de domínio nesta feature).
- Persistência em banco (a coluna `score_pcm` já é gerada pelo Postgres no legado — aqui é domínio puro TypeScript).
- Lógica de repriorização por IA (feature futura separada).

## Riscos / premissas
- Score GUT máximo é 125 (5×5×5) — se regra mudar, o domínio e os testes devem ser atualizados juntos.
- Fatores GUT são sempre inteiros no intervalo [1,5] — validação rigorosa na borda do domínio.
