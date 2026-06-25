---
name: product
description: PRD-lite do cálculo de comissão (exemplo de referência).
alwaysApply: false
---

# Product — Cálculo de comissão de vendedor por faixa

> **Tier:** pequeno · **Status:** aprovado · **Dono:** <PM>
> Responde: **por quê** e **para quem**.

## Problema
A comissão dos vendedores hoje é calculada à mão em planilha, gerando divergências e retrabalho
no fechamento. Precisamos de um cálculo único, determinístico e testável.

## Para quem
Time comercial (vendedores e fechamento financeiro). Roda a cada venda fechada e no fechamento
mensal.

## Resultado esperado / métrica de sucesso
- Métrica: divergências de comissão reportadas no fechamento.
- Baseline: ~várias por mês → Alvo: zero divergência de cálculo.

## Goals
- Função de cálculo determinística, coberta por testes que espelham os AC.

## Non-goals
- Comissão progressiva, impostos, persistência, UI (ver "Fora de escopo" na spec).

## Riscos / premissas
- Premissa: a tabela de comissão vigente é fornecida pelo chamador (não é responsabilidade desta feature).
