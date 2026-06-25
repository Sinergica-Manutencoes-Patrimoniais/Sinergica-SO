---
name: spec-0001-priorizacao-backlog-gut
description: Contrato da feature de priorização de backlog por GUT (AC testáveis). Fonte da verdade do gate de testes.
alwaysApply: false
---

# Spec — Priorização de Backlog por Matriz GUT

> Status: **implementado** · Tier: pequeno

## Resumo
O sistema calcula o score de prioridade de um item de backlog como `gravidade × urgência × tendência`
(cada fator inteiro de 1 a 5, score de 1 a 125), classifica em faixas qualitativas e ordena o
backlog do mais crítico para o menos, de forma estável.

## Critérios de aceite (AC)

### AC-1: Cálculo correto do score GUT
- Dado um item de backlog com gravidade G, urgência U e tendência T (todos inteiros de 1 a 5)
- Quando o sistema calcular o score GUT
- Então o score é `G × U × T` (inteiro entre 1 e 125 inclusive)

### AC-2: Rejeição de fator inválido
- Dado um fator GUT com valor fora de [1,5] ou não inteiro (ex.: 0, 6, 1.5)
- Quando o sistema tentar calcular o score
- Então um `RangeError` é lançado com mensagem identificando o fator problemático; nenhum score é produzido

### AC-3: Classificação em faixas de prioridade
- Dado um score GUT válido (inteiro de 1 a 125)
- Quando o sistema classificar a prioridade
- Então: score ≥100 → `"critica"` · score ≥50 → `"alta"` · score ≥20 → `"media"` · score <20 → `"baixa"`

### AC-4: Ordenação estável do backlog por score desc
- Dado uma lista de itens priorizáveis com scores distintos ou iguais
- Quando o sistema ordenar o backlog
- Então: itens com score maior aparecem primeiro; itens com score igual mantêm a ordem original de entrada; o array de entrada não é mutado

## Casos de borda e erros
- Score máximo: 5×5×5 = 125 (crítica).
- Score mínimo: 1×1×1 = 1 (baixa).
- Fator = 0 → `RangeError`.
- Fator = 6 → `RangeError`.
- Fator = 1.5 → `RangeError`.
- Lista vazia → lista vazia (sem erro).

## Fora de escopo (VINCULANTE)
- Persistência em banco (o score gerado pelo Postgres é responsabilidade da migration).
- Interface de usuário (telas do backlog são features separadas).
- Sugestão de GUT por IA (feature futura).
- Edição de fatores GUT (responsabilidade da feature de cadastro de backlog item).

## Rastreabilidade
- Product: [product.md](product.md)
- Domain: [domain.md](domain.md)
- Tasks: [tasks.md](tasks.md)
- Implementação: `apps/web/src/features/pcm/domain/priorizacao-backlog.ts`
