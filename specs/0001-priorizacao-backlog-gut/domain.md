---
name: domain-0001-priorizacao-backlog-gut
description: Modelo DDD da priorização de backlog por GUT — bounded context, value objects, invariantes. Puxe ao modelar ou nomear entidades.
alwaysApply: false
---

# Domain Model (DDD) — Priorização de Backlog por Matriz GUT

## Bounded Context
**PCM / Operação**. Subdomínio: **core** (sustentação do negócio principal).

## Linguagem ubíqua
| Termo | Definição | NÃO confundir com |
|-------|-----------|-------------------|
| **FatorGut** | Inteiro de 1 a 5 que representa gravidade, urgência ou tendência | Score GUT (o produto dos três fatores) |
| **ScoreGut** | Produto dos três fatores GUT — inteiro de 1 a 125 | Prioridade (classificação qualitativa) |
| **PrioridadeBacklog** | Faixa qualitativa derivada do score: crítica/alta/média/baixa | Categoria da OS (tipo de trabalho) |
| **ItemPriorizavel** | Qualquer entidade com `id` e `score` que possa ser ordenada | Backlog Item (entidade completa) |

## Value objects e funções puras
- **`FatorGut`** — tipo literal `1 | 2 | 3 | 4 | 5`. Invariante: inteiro no intervalo [1,5].
- **`calcularScoreGut(g, u, t)`** — `g × u × t`. Lança `RangeError` se qualquer fator for inválido.
- **`classificarPrioridade(score)`** — mapeia score → `PrioridadeBacklog`. Lança `RangeError` para score fora de [1,125].
- **`ordenarPorPrioridade(itens)`** — sort estável por score desc. Não muta o array de entrada.

## Invariantes (garantidas na construção)
1. Fator GUT é sempre inteiro entre 1 e 5; qualquer outro valor lança `RangeError`.
2. Score GUT é sempre inteiro entre 1 e 125 (produto de fatores válidos).
3. Ordenação é estável: itens com score igual mantêm ordem de entrada.

## Faixas de prioridade
| Score | Prioridade |
|-------|-----------|
| 100–125 | crítica |
| 50–99 | alta |
| 20–49 | média |
| 1–19 | baixa |

## Localização no código
`apps/web/src/features/pcm/domain/priorizacao-backlog.ts`

## Relações com outros contextos
- **PCM (infraestrutura)**: `score` calculado no domínio TypeScript; persiste como coluna gerada no Postgres (`score_pcm GENERATED ALWAYS AS (gravidade * urgencia * tendencia) STORED`).
- **Sem dependência de outro contexto** — domínio puro, zero I/O.
