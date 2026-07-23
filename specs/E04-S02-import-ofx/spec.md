---
name: spec
description: Contrato — importação de extrato bancário OFX com dedupe por FITID, regras de classificação e conciliação com lançamentos.
alwaysApply: true
---

# Spec — E04-S02 · Import de extrato OFX + classificação + conciliação

> **Fonte da verdade.** Status: implementado e com gates automatizados verdes; UAT externo com OFX
> real anonimizado pendente · Tier: pequeno
> **Depende de: E04-S01** (schema `financeiro`, tela de Lançamentos). Design do épico:
> `specs/E04-S01-fundacao-financeiro/design.md` (§S02 tem o contrato das tabelas; D-1 fecha a
> decisão do parser). Visão de produto: `specs/E04-S01-fundacao-financeiro/product.md`.

## Resumo
O time financeiro baixa o OFX do banco e importa no sistema: prévia do que foi lido → dedupe por
`(conta, FITID)` → sugestão de categoria/cliente/fornecedor por regras de texto → cada transação
vira (a) conciliação com um lançamento `previsto` existente, (b) um lançamento novo `realizado`,
ou (c) ignorada. Reimportar o mesmo arquivo nunca duplica nada. Decisão de escopo herdada
(ESCOPO-MESTRE §11 D3): **importação manual de OFX, sem Open Finance**.

## Critérios de aceite

### AC-1: Parser OFX puro
- **Dado** um arquivo OFX 1.x (SGML) ou 2.x (XML) de banco brasileiro (formatos cobertos por
  fixtures sintéticas; compatibilidade do banco usado em produção homologada por UAT com arquivo
  real anonimizado)
- **Quando** `parseOfx(texto)` roda (função pura em `domain/ofx.ts`, sem I/O, sem lib nova)
- **Então** devolve as transações com FITID, data, valor em centavos **com sinal** (parse da
  string decimal, nunca float), memo e tipo; arquivo ilegível devolve erro claro, nunca exceção
  não tratada

### AC-2: Import idempotente
- **Dado** um OFX já importado para uma conta
- **Quando** o mesmo arquivo (ou outro com FITIDs sobrepostos) é importado de novo
- **Então** só transações com FITID inédito para aquela conta entram; a prévia mostra
  "N novas / M já importadas"

### AC-3: Classificação sugerida por regras
- **Dado** regras em `financeiro.regras_classificacao` (padrão de texto, case-insensitive, sobre o
  memo) apontando categoria e opcionalmente cliente/fornecedor
- **Quando** a prévia do import monta
- **Então** cada transação que casa com uma regra vem pré-classificada (usuário pode trocar antes
  de confirmar); ao classificar manualmente uma transação, o sistema oferece "criar regra a partir
  desta"

### AC-4: Conciliar com previsto
- **Dado** uma transação pendente e lançamentos `previstos` da mesma conta com valor igual e
  vencimento até ±5 dias da data da transação
- **Quando** o usuário abre a transação
- **Então** vê esses candidatos e pode conciliar: o lançamento vira `realizado` (data de pagamento
  = data da transação) + `conciliado` (vínculo 1:1); a transação sai da fila de pendentes;
  desfazer a conciliação reverte os dois lados

### AC-5: Criar lançamento a partir da transação
- **Dado** uma transação pendente sem lançamento correspondente
- **Quando** o usuário confirma a classificação
- **Então** nasce um lançamento `realizado` já conciliado (origem `ofx`, valor/data/conta da
  transação, categoria/cliente/fornecedor escolhidos)

### AC-6: Ignorar transação
- **Dado** uma transação que não deve virar lançamento (ex.: transferência entre contas próprias)
- **Quando** o usuário marca "ignorar"
- **Então** ela sai da fila com status `ignorado`, reversível, e continua contando para o dedupe

## Fora de escopo
> Vinculante.
- Open Finance / conexão automática com banco (decisão D3).
- Import CSV (só OFX no V1; CSV é evolução se algum banco não exportar OFX).
- Conciliação automática sem confirmação humana (sugestão sempre passa pelo usuário no V1).
- Regras com regex exposto ao usuário (padrão = substring case-insensitive; regex é evolução).

## Rastreabilidade
- Origem: ESCOPO-MESTRE §6.5 ("Conciliação — extrato bancário × lançamentos; mínimo: importação
  CSV/OFX, baixa manual") + decisão D3.
- Tabelas: `financeiro.extrato_transacoes`, `financeiro.regras_classificacao` + FK
  `lancamentos.extrato_transacao_id` — contrato em `specs/E04-S01-fundacao-financeiro/design.md` §S02.
- Arquivos-âncora: `apps/web/src/features/financeiro/domain/ofx.ts` + `conciliacao.ts` (novos),
  `pages/ImportOfxPage.tsx`, migration nova em `supabase/migrations/` (sequência seguinte à da S01).
- **UAT externo pós-merge:** OFX real do banco da Sinérgica, anonimizado. O insumo homologa o banco
  de produção e não bloqueia o merge do parser já coberto nos formatos 1.x/2.x; até ser fornecido,
  o parser não deve ser declarado homologado para esse banco específico.
