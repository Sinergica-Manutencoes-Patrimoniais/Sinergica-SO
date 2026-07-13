---
name: spec
description: Contrato — Dashboard Financeiro: KPIs de caixa e gráficos (fluxo mensal, categorias, evolução de saldo, previsto × realizado) via RPC server-side.
alwaysApply: true
---

# Spec — E04-S03 · Dashboard de caixa

> **Fonte da verdade.** Status: pronto para implementar · Tier: pequeno
> **Depende de: E04-S01.** Design do épico: `specs/E04-S01-fundacao-financeiro/design.md`
> (D-2: gráficos SVG próprios, sem lib — consultar a skill `dataviz` antes de codar;
> D-3: agregação server-side via RPC `security invoker`, padrão `fn_kpis_ordens_servico`/`0076`).

## Resumo
Página inicial do módulo Financeiro: a visão de dono. KPIs e gráficos calculados no banco
(nunca baixar a tabela de lançamentos pro browser) sobre o que a S01 (e depois S04/S05) gravam.
Funciona com os dados que existirem: sem contratos ainda, os cards de previsto mostram só o que
houver de lançamentos previstos.

## Critérios de aceite

### AC-1: KPIs do topo
- **Dado** lançamentos e contas cadastrados
- **Quando** o dashboard carrega (RPC `financeiro.fn_resumo_caixa`)
- **Então** mostra: posição de caixa (Σ saldos derivados das contas ativas), entradas do mês,
  saídas do mês, resultado do mês, a receber 30d e a pagar 30d (previstos com vencimento na
  janela) — todos coerentes com os mesmos filtros aplicados na tela de Lançamentos

### AC-2: Fluxo mensal (12 meses)
- **Dado** lançamentos realizados nos últimos 12 meses (por competência)
- **Quando** o gráfico de fluxo renderiza (RPC `fn_fluxo_mensal`)
- **Então** mostra barras de entrada e saída por mês + linha/indicação de resultado; mês sem
  movimento aparece zerado (não some do eixo)

### AC-3: Gasto por categoria
- **Dado** saídas realizadas no período selecionado (mês corrente por padrão, seletor de período)
- **Quando** o gráfico de categorias renderiza
- **Então** mostra o top de categorias de nível 1 (com drill para nível 2) por valor, com
  percentual do total

### AC-4: Previsto × realizado
- **Dado** lançamentos previstos e realizados do mês
- **Quando** o bloco previsto × realizado renderiza
- **Então** compara entrada prevista × recebida e saída prevista × paga no mês corrente

### AC-5: Gráficos no padrão visual
- **Dado** os componentes de gráfico (SVG próprio em `components/graficos/`)
- **Quando** o tema muda (claro/escuro)
- **Então** os gráficos permanecem legíveis nos dois temas (tokens CSS do repo), com estados de
  vazio ("sem movimentos no período") e de erro honesto (padrão do repo — nunca mascarar erro
  real como "sem dados", regra do @qa desde E01-S12)

## Fora de escopo
> Vinculante.
- Projeção de caixa 30/60/90 (chega na E04-S05, que estende este dashboard).
- Margem/rentabilidade por cliente (E04-S06, tela própria).
- Lib de gráficos externa (design D-2; mudar isso exige ADR).
- Export PDF/Excel.

## Rastreabilidade
- Origem: pedido do PO ("gráficos para visualização", visão de dono — `product.md` do épico) +
  ESCOPO-MESTRE §6.5 (fluxo de caixa) e §6.8 (o Cockpit E08 reusa estas RPCs/views depois).
- Arquivos-âncora: `pages/FinanceiroDashboardPage.tsx`, `components/graficos/` (novos),
  migration nova com as RPCs `fn_resumo_caixa`/`fn_fluxo_mensal` (+ grants execute para
  `authenticated`), padrão de RPC em `0076_E01-S44_rpc_kpis_ordens_servico.sql`.
- Antipadrão proibido: `select *` da tabela inteira + `reduce()` no front (eliminado na E01-S44).
