---
name: domain
description: Modelo DDD do cálculo de comissão (exemplo de referência).
alwaysApply: false
---

# Domain Model (DDD) — Cálculo de comissão

> Responde: a **linguagem** e o **modelo** do negócio. Termos aqui aparecem iguais no código.

## Bounded Context
**Comercial / Comissionamento** — subdomínio **core** (regra de negócio que diferencia o
processo de fechamento).

## Linguagem ubíqua
| Termo            | Definição                                                          | NÃO confundir com          |
|------------------|--------------------------------------------------------------------|----------------------------|
| Dinheiro         | Valor monetário em centavos (inteiro), não-negativo                | `number` solto / float     |
| Faixa de comissão| Par (valor mínimo, percentual) válido a partir do mínimo (inclusivo)| imposto, desconto          |
| Tabela de comissão| Conjunto ordenado de faixas vigentes                              | tabela de preços           |
| Comissão         | Valor que o vendedor recebe = venda × percentual da faixa atingida | comissão progressiva       |

## Agregados, entidades e value objects
- **Value object `Dinheiro`**
  - Representado em **centavos** (inteiro). Ver [ADR-0001](../../../docs/adr/0001-dinheiro-em-centavos.md).
  - **Invariantes:** não-negativo; inteiro (sem fração de centavo).
- **Value object `FaixaComissao`**
  - Campos: `minimo: Dinheiro`, `percentual` (0–100).
  - **Invariante:** percentual entre 0 e 100.
- **Agregado `TabelaComissao`** (raiz)
  - Lista de `FaixaComissao` ordenada por `minimo` crescente.
  - **Invariante:** sem faixas duplicadas no mesmo mínimo.
  - Comportamento: `faixaPara(valor)` → a faixa de maior `minimo` que seja ≤ valor (ou nenhuma).

## Eventos de domínio
> Não há eventos nesta feature (cálculo puro, sem efeito colateral).

## Relações com outros contextos
Nenhuma fronteira nova. A feature é uma função pura consumida pela camada `application`.
