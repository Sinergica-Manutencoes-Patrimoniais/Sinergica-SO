---
name: spec
description: Contrato — fundação do módulo Financeiro: schema (categorias, contas, fornecedores, lançamentos), RLS, telas de Lançamentos/Categorias/Contas e seed do plano de contas.
alwaysApply: true
---

# Spec — E04-S01 · Fundação do caixa (lançamentos + plano de contas + contas bancárias)

> **Fonte da verdade.** Status: pronto para implementar · Tier: **arquitetural**
> (`design.md` e `domain.md` desta pasta são leitura obrigatória antes de codar; `product.md` dá a
> visão do épico). Primeira story do E04 — nada do schema `financeiro` existe ainda.
> Auto-contida: contexto completo em `product.md`/`design.md`; padrões do repo em `CLAUDE.md`.

## Resumo
Cria o schema mínimo do caixa (4 tabelas com RLS FORCE + seed do plano de contas), a feature
hexagonal `features/financeiro/` e 3 telas: **Lançamentos** (entrada/saída com ciclo
previsto→realizado), **Categorias** e **Contas bancárias** — plugadas na sidebar sob FINANCEIRO
com gate de permissão do módulo. É o pré-requisito de todas as demais stories E04.

## Critérios de aceite

### AC-1: Schema com RLS FORCE
- **Dado** as migrations aplicadas (`financeiro.categorias`, `contas_bancarias`, `fornecedores`,
  `lancamentos` — contrato de colunas no `design.md`)
- **Quando** um usuário sem `financeiro` em `user_modulos` (e não-superadmin) consulta qualquer
  uma delas
- **Então** recebe zero linhas; com `leitura` lê mas não escreve; com `escrita` (ou superadmin)
  faz CRUD — provado por pgTAP (padrão dos testes em `supabase/tests/`)

### AC-2: Seed do plano de contas
- **Dado** a migration da S01 aplicada
- **Quando** a tela de Categorias carrega
- **Então** exibe o plano de contas inicial (2 níveis, entrada e saída, lista no `design.md`),
  todas com `seed=true`, editáveis e desativáveis

### AC-3: Registrar lançamento
- **Dado** um usuário com `financeiro='escrita'`
- **Quando** cria um lançamento (tipo, valor em R$ convertido para centavos, competência,
  categoria, conta/cliente/fornecedor opcionais, status previsto ou realizado)
- **Então** o lançamento aparece na lista; `previsto` exige vencimento e `realizado` exige data de
  pagamento (validação no domínio, com teste unit)

### AC-4: Listar e filtrar
- **Dado** lançamentos existentes
- **Quando** o usuário filtra por período, tipo, categoria, conta, cliente ou status
- **Então** a lista e os totais (entradas, saídas, resultado do filtro) refletem só o filtrado

### AC-5: Baixa de previsto
- **Dado** um lançamento `previsto`
- **Quando** o usuário dá baixa informando a data de pagamento
- **Então** vira `realizado` mantendo competência/valor; a ação é reversível (estornar baixa)

### AC-6: Contas com saldo derivado
- **Dado** uma conta com saldo inicial e lançamentos realizados vinculados
- **Quando** a tela de Contas carrega
- **Então** mostra saldo atual = saldo inicial + Σ(entradas) − Σ(saídas) realizadas desde a data
  de corte — calculado por query/RPC, nunca coluna gravada

### AC-7: Gate de navegação
- **Dado** a sidebar (grupo FINANCEIRO em `HomePage.tsx`)
- **Quando** o usuário não tem o módulo `financeiro`
- **Então** os itens não aparecem; com `leitura`, telas abrem read-only (sem botões de criar/editar)

## Fora de escopo
> Vinculante. Não implementar nada daqui nesta story.
- Import OFX, conciliação, regras de classificação (E04-S02).
- Dashboard/gráficos (E04-S03) · contratos/recebíveis (E04-S04) · contas a pagar recorrentes
  (E04-S05) · rentabilidade/custo-hora (E04-S06).
- NF-e, Open Finance, visão do síndico (non-goals do épico — `product.md`).
- Edge Function nova (design D-6: tudo via supabase-js sob RLS + RPC SQL).

## Rastreabilidade
- Origem: ESCOPO-MESTRE §6.5 + §11 D3 · `docs/blueprint/04-financeiro.md` · decisões do PO em
  `product.md` (2026-07-13).
- Padrões: RLS/policies e contrato de colunas → `design.md` desta pasta; exemplo de policy real →
  migration `0079_E01-S54_despesas_auvo.sql`; RPC de agregação → `0076_E01-S44`.
- Arquivos-âncora: `supabase/migrations/` (próximo número livre; era `0083` o último),
  `apps/web/src/features/financeiro/` (novo), `apps/web/src/app/HomePage.tsx` (navegação),
  `apps/web/src/features/config/domain/modulo.ts` (`financeiro` já é `ModuloId`),
  `supabase/config.toml` (expor schema `financeiro` no PostgREST — ver design).
