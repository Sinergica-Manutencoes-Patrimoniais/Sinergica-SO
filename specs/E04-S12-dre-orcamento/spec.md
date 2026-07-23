---
name: spec-E04-S12-dre-orcamento
description: Contrato — DRE gerencial por regime de competência + orçamento anual (meta por categoria) com comparativo realizado × orçado.
alwaysApply: true
tier: pequeno
---

# Spec — DRE gerencial + orçamento anual

> **Fonte da verdade.** Status: aprovado. Depende de **E04-S01/S03** (+ S10 para imposto no resultado).
> Origem: sugestão de dashboard — o dashboard de S03 é **caixa**; falta a visão de **resultado
> (competência)** e a comparação com **orçamento**.

## Resumo
Duas visões gerenciais novas: um **DRE gerencial** (Demonstração de Resultado por regime de
competência — receita, custos, despesas, imposto, resultado líquido, por mês) e um **orçamento anual**
(meta por categoria) com comparativo **realizado × orçado**.

## Contexto atual (AS-IS)
- `financeiro.lancamentos.data_competencia` já suporta competência. Dashboard atual (E04-S03) é caixa
  (previsto/realizado por data de pagamento). Imposto vem de E04-S10.

## Critérios de aceite

### AC-1: DRE gerencial por competência
- **Dado** um período (mês/12m)
- **Quando** o usuário abre o DRE
- **Então** vê receita líquida, custos, despesas por grupo de categoria, imposto e **resultado
  líquido** por competência (não por caixa), com totais por mês.

### AC-2: Orçamento por categoria
- **Dado** um `superadmin`/financeiro
- **Quando** define metas anuais/mensais por categoria (plano de contas)
- **Então** o orçamento é persistido por categoria/competência.

### AC-3: Realizado × orçado
- **Dado** orçamento definido e lançamentos realizados
- **Quando** o usuário abre o comparativo
- **Então** vê, por categoria, o orçado vs realizado e o desvio (R$ e %), destacando estouros.

### AC-4: Consistência
- **Dado** DRE e dashboard de caixa
- **Quando** ambos abrem o mesmo período
- **Então** a diferença entre eles é explicável por competência × caixa (não por erro de dado).

## Casos de borda e erros
- Categoria sem orçamento → aparece só o realizado (sem desvio).
- Mês sem lançamento → linha zerada, não some.

## Fora de escopo (vinculante)
- DRE contábil oficial (é gerencial).
- Rateio automático de custo indireto por cliente (a rentabilidade por cliente é E04-S06).

## Rastreabilidade
- Migration: orçamento por categoria/competência (RLS)
- Domínio: agregação de DRE por competência (função pura) + desvio orçado×realizado
- RPC server-side para o DRE/comparativo (padrão E04-S03)
- `apps/web/src/features/financeiro/` (telas DRE + Orçamento) — reusa gráficos SVG de E04-S03
