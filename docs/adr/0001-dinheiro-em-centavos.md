---
name: adr-0001-dinheiro-em-centavos
description: Decisão de representar valores monetários em centavos inteiros.
alwaysApply: false
---

# ADR-0001 — Dinheiro em centavos (inteiro)

**Status:** Aceito
**Data:** <YYYY-MM-DD>
**Decisores:** @architect, @dev
**Relacionados:** spec `0001-calculo-comissao`

## Contexto
Cálculo de comissão lida com dinheiro. Usar `number` em ponto flutuante (reais com decimais)
introduz erros de arredondamento (ex.: `0.1 + 0.2 !== 0.3`), inaceitáveis em valores financeiros.
A decisão afeta todo o domínio monetário e é custosa de reverter depois que houver dado.

## Decisão
Representar todo valor monetário como **centavos em inteiro** dentro de um value object `Dinheiro`.
Conversões para/de reais acontecem só na borda (interfaces). O domínio nunca usa float para dinheiro.

## Alternativas consideradas
| Alternativa            | Prós                        | Contras                                  | Por que (não) escolhida |
|------------------------|-----------------------------|------------------------------------------|-------------------------|
| Centavos inteiros (A)  | exato, simples, sem libs    | precisa converter na borda               | **escolhida**           |
| `number` em reais      | direto                      | erro de arredondamento financeiro        | rejeitada (incorreta)   |
| Lib decimal (big.js)   | exata                       | dependência extra para caso simples      | rejeitada (overkill)    |

## Consequências
**Positivas:**
- Cálculo determinístico e exato; testes estáveis.

**Negativas / trade-offs aceitos:**
- Conversão reais↔centavos precisa ser feita conscientemente na borda.
