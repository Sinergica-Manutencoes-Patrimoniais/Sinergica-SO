---
name: spec
description: Contrato — contas a pagar (fornecedores, vencimentos, despesas fixas recorrentes) e projeção de caixa 30/60/90 no dashboard.
alwaysApply: true
---

# Spec — E04-S05 · Contas a pagar + projeção de caixa

> **Fonte da verdade.** Status: pronto para implementar · Tier: pequeno
> **Depende de: E04-S01** (lançamentos) e **E04-S03** (dashboard — a projeção entra lá).
> Design do épico: `specs/E04-S01-fundacao-financeiro/design.md` (§S05 tabela `recorrencias`;
> D-4 geração idempotente — mesma RPC `fn_gerar_recorrencias` da S04, estendida para saídas).

## Resumo
Fecha o lado da saída: tela de Contas a Pagar (previstos de saída por vencimento, baixa) +
cadastro de despesas fixas mensais (`financeiro.recorrencias`) que a RPC de recorrência
materializa como lançamentos previstos junto com os contratos (S04). Com os dois lados previstos,
o dashboard ganha a projeção de caixa 30/60/90 — a resposta a "como fecha o mês?".

## Critérios de aceite

### AC-1: Despesa fixa recorrente
- **Dado** um usuário com `financeiro='escrita'`
- **Quando** cadastra uma recorrência de saída (descrição, valor, dia de vencimento 1–28,
  categoria, fornecedor/conta opcionais)
- **Então** a geração do mês (mesmo botão/cron da S04) cria exatamente 1 lançamento de saída
  `previsto` por recorrência ativa — idempotente (unique parcial `recorrencia_id,
  data_competencia`); desativar a recorrência para de gerar sem apagar o histórico

### AC-2: Tela Contas a Pagar
- **Dado** lançamentos de saída `previstos`
- **Quando** a tela carrega
- **Então** lista por vencimento (vencidos destacados, mesmo padrão de faixas do aging da S04),
  com baixa por linha (data de pagamento) e filtros por fornecedor/categoria/período

### AC-3: Projeção de caixa 30/60/90
- **Dado** posição de caixa atual (S03) + previstos de entrada e saída com vencimento
- **Quando** o dashboard carrega (RPC `financeiro.fn_projecao_caixa`)
- **Então** mostra o saldo projetado em +30/+60/+90 dias (posição + entradas previstas − saídas
  previstas da janela), com detalhamento por semana ao expandir; dias com saldo projetado
  negativo ganham destaque de alerta

### AC-4: Coerência previsto → realizado
- **Dado** um previsto de saída baixado ou conciliado (S02)
- **Quando** a projeção recalcula
- **Então** ele sai do futuro projetado e entra no realizado — nunca conta duas vezes

## Fora de escopo
> Vinculante.
- Agendamento/pagamento bancário real (o sistema registra, não paga).
- Aprovação em duas etapas de pagamentos (workflow — evolução).
- Rateio de uma despesa entre categorias/centros de custo (V1: 1 lançamento = 1 categoria).
- Recorrência de entrada (isso é contrato — S04).

## Rastreabilidade
- Origem: ESCOPO-MESTRE §6.5 (Contas a Pagar — fornecedores, despesas; Fluxo de Caixa — previsto
  vs realizado, posição de caixa) + decisão do PO "previsto + realizado no V1" (`product.md`).
- Tabela/RPC: `financeiro.recorrencias` + coluna `lancamentos.recorrencia_id` + extensão de
  `fn_gerar_recorrencias` + `fn_projecao_caixa` — contrato em
  `specs/E04-S01-fundacao-financeiro/design.md` §S05/D-4.
- Arquivos-âncora: `pages/ContasPagarPage.tsx`, bloco de projeção em
  `FinanceiroDashboardPage.tsx` (S03), migration nova.
