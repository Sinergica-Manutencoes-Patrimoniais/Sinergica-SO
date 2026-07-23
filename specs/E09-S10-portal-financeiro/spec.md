---
name: spec-E09-S10-portal-financeiro
description: Contrato — aba financeira do portal (faturas/vencimentos/2ª via) via views do cliente-síndico; NUNCA custo/rentabilidade. BLOQUEADA até o E04 ser construído.
alwaysApply: true
tier: pequeno
---

# Spec — Financeiro no portal (faturas/vencimentos/2ª via)

> **Fonte da verdade.** Status: aprovado, **BLOQUEADA por dependência**. Depende de E09-S01 e do
> **módulo Financeiro E04 construído** (hoje o schema `financeiro` está vazio — só especificado).
> Origem: pedido do Lucas ("olhar a parte financeira"). Decisão do PO: faturas/vencimentos/2ª via.

## Resumo
O síndico vê a situação financeira do seu contrato: **faturas, vencimentos e status de pagamento**,
com 2ª via/comprovante. **Nunca** expõe custo, margem ou rentabilidade interna.

## Dependência dura (bloqueio)
O módulo Financeiro (E04) **não está implementado** — `financeiro` é schema vazio desde `0001`;
`financeiro.contratos`/`lancamentos`/views são só especificação (E04-S01/S04/S06). Além disso o design
do E04 declara `cliente-sindico` como **deny-by-default** e adia "views do síndico" para E09
(`specs/E04-S01-.../design.md:26-27,190-191`). Logo, esta story **só pode ser implementada depois** de:
(1) E04 fundação + contratos/contas a receber construídos; (2) views financeiras dedicadas ao
`cliente-sindico`.

## Critérios de aceite

### AC-1: Ver faturas/vencimentos do próprio contrato
- **Dado** um síndico logado (com E04 construído)
- **Quando** abre a aba Financeiro
- **Então** vê as faturas/parcelas do **seu** contrato: valor, vencimento, status (paga/em aberto/
  vencida), escopado por `cliente_id`.

### AC-2: 2ª via / comprovante
- **Dado** uma fatura
- **Quando** o síndico pede a 2ª via
- **Então** obtém o documento/boleto (signed URL se arquivo), sem expor bucket.

### AC-3: NUNCA dado interno
- **Dado** o financeiro do cliente
- **Quando** o síndico visualiza
- **Então** **jamais** vê custo, margem ou rentabilidade — só o que é devido/pago por ele (regra do
  blueprint 09; a exposição fica em **views restritas** ao papel, não na tabela crua).

### AC-4: Isolamento por-linha
- **Dado** dados financeiros de vários clientes
- **Quando** o síndico consulta
- **Então** só os do seu `cliente_id` (RLS/views), nunca de outro.

## Fora de escopo (vinculante)
- Construir o E04 (pré-requisito, épico separado).
- Emissão de NF-e/boleto/cobrança automática (fora até do E04 V1 interno).
- Pagamento online no portal (evolução futura).

## Rastreabilidade
- `apps/web/src/features/area-cliente/` (aba Financeiro)
- Fontes: views dedicadas em `financeiro` para `cliente-sindico` (a criar quando E04 existir) sobre
  `financeiro.contratos`/`lancamentos` (E04-S04)
- Regra a fixar também no blueprint: `docs/blueprint/09-area-cliente.md` (expõe fatura/vencimento,
  nunca custo/rentabilidade) — resolve a divergência com `ESCOPO-MESTRE §6.9`
