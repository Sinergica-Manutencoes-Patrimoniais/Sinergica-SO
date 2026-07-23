---
name: spec-E04-S11-exportacao-contabil-fechamento
description: Contrato — exportação contábil (CSV/Excel) e fechamento mensal do Financeiro, para entregar ao contador e travar o período.
alwaysApply: true
tier: pequeno
---

# Spec — Exportação contábil + fechamento mensal

> **Fonte da verdade.** Status: aprovado. Depende de **E04-S01** (+ S04/S05 para dados completos).
> Origem: pedido do Lucas — usar com clientes de verdade exige entregar dados ao contador e fechar mês.

## Resumo
O Financeiro passa a **exportar** os dados do período (lançamentos, recebíveis, pagáveis, por
categoria/conta/cliente) em CSV/Excel para o contador, e a **fechar o mês** — travando o período
contra alterações depois do fechamento.

## Contexto atual (AS-IS)
- `financeiro.lancamentos` com `data_competencia`/`data_pagamento`, categoria, conta, cliente,
  fornecedor (E04-S01). Sem exportação nem trava de período hoje.

## Critérios de aceite

### AC-1: Exportar período
- **Dado** um período (mês/intervalo)
- **Quando** o usuário exporta
- **Então** baixa um arquivo (CSV e/ou Excel) com os lançamentos do período (competência e caixa),
  colunas legíveis (data, tipo, valor, categoria, conta, cliente/fornecedor, status, descrição),
  pronto para o contador.

### AC-2: Fechamento mensal
- **Dado** um mês conciliado/revisado
- **Quando** o usuário fecha o mês
- **Então** o período fica **travado**: novos lançamentos e edições naquela competência são
  bloqueados (ou exigem reabertura explícita e auditável).

### AC-3: Reabertura auditável
- **Dado** um mês fechado
- **Quando** um `superadmin` reabre
- **Então** a reabertura é registrada (quem/quando/porquê) e o período volta a aceitar edição; refechar
  é possível.

### AC-4: Consistência da exportação
- **Dado** a exportação
- **Quando** gerada
- **Então** os totais batem com o dashboard do mesmo período (mesma fonte, sem divergência).

## Casos de borda e erros
- Exportar período sem dados → arquivo com cabeçalho, sem erro.
- Lançar em mês fechado → bloqueado com mensagem clara.

## Fora de escopo (vinculante)
- SPED / arquivo fiscal oficial (formato contábil regulado — futuro, se o contador exigir).
- Integração direta com sistema do contador (é exportação de arquivo).

## Rastreabilidade
- Migration: estado de fechamento por competência + eventos de fechamento/reabertura (append-only)
- Domínio: guarda de "mês fechado" nas escritas de lançamento (reusa regra de conciliado de S01)
- `apps/web/src/features/financeiro/` (botão exportar + fechar mês)
- Exportação: geração CSV/Excel client-side ou RPC server-side (mesma fonte do dashboard E04-S03)
