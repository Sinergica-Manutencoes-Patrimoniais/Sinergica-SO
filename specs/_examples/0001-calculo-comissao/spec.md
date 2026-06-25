---
name: spec
description: Contrato da feature de cálculo de comissão (exemplo de referência). Base enquanto ativa.
alwaysApply: true
---

# Spec — Cálculo de comissão de vendedor por faixa

> **Fonte da verdade.** Status: implementado · **Tier: pequeno** (feature isolada, sem decisão
> arquitetural → não exige `design.md`; ver `ANTI-PADROES.md`).
> Este é o **exemplo de referência** do Padrão OS: copie o padrão dele, não o conteúdo.

## Resumo
Dado o valor de uma venda e a tabela de comissão vigente, o sistema calcula quanto o vendedor
recebe de comissão, aplicando o percentual da faixa em que a venda se enquadra.

## Critérios de aceite

### AC-1: venda dentro de uma faixa recebe o percentual da faixa
- **Dado** uma tabela com faixa "5%" a partir de R$ 1.000,00
- **Quando** calculo a comissão de uma venda de R$ 2.000,00
- **Então** a comissão é R$ 100,00 (5% de 2.000)

### AC-2: venda abaixo do mínimo da primeira faixa não gera comissão
- **Dado** uma tabela cuja primeira faixa começa em R$ 1.000,00
- **Quando** calculo a comissão de uma venda de R$ 999,99
- **Então** a comissão é R$ 0,00

### AC-3: venda exatamente no limite usa a faixa superior
- **Dado** uma tabela com faixas "5% a partir de R$ 1.000,00" e "8% a partir de R$ 5.000,00"
- **Quando** calculo a comissão de uma venda de exatamente R$ 5.000,00
- **Então** aplica 8% → comissão R$ 400,00

### AC-4: valor de venda inválido é rejeitado
- **Dado** qualquer tabela
- **Quando** calculo a comissão de uma venda negativa
- **Então** a operação falha com erro de validação (não retorna número)

## Matriz de decisão
> Tabela com faixas: `[5% ≥ 1000]`, `[8% ≥ 5000]`. Valores em reais.

| Valor da venda | Faixa aplicável | Comissão esperada | AC   |
|----------------|-----------------|-------------------|------|
| 999,99         | nenhuma         | 0,00              | AC-2 |
| 1.000,00       | 5%              | 50,00             | AC-1 |
| 2.000,00       | 5%              | 100,00            | AC-1 |
| 5.000,00       | 8%              | 400,00            | AC-3 |
| 10.000,00      | 8%              | 800,00            | AC-1 |
| -1,00          | —               | erro de validação | AC-4 |

## Casos de borda e erros
- Tabela vazia (sem faixas) → comissão 0,00 para qualquer venda válida.
- Valor exatamente no mínimo de uma faixa → entra na faixa (limite inclusivo).
- Valor não inteiro em centavos (ex.: fração de centavo) → rejeitado na construção de `Dinheiro`.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Comissão progressiva/escalonada (somar percentuais por faixa) — só a faixa atingida vale.
- Persistência da tabela em banco, UI, e cálculo de impostos sobre a comissão.
- Comissão por equipe/override de gerência.

## Rastreabilidade
- Product: `./product.md` · Domínio: `./domain.md` · Tasks: `./tasks.md`
- ADRs relacionados: [ADR-0001 — Dinheiro em centavos](../../../docs/adr/0001-dinheiro-em-centavos.md)
