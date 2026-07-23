---
name: spec-E01-S91-clientes-marcacoes-status
description: Contrato — marcações de status de cliente gerenciáveis (nome/cor), 1 por cliente, com filtro de listas para exibir só ativos.
alwaysApply: true
tier: pequeno
---

# Spec — Marcações de status de cliente

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16), item 8.1. "Poder marcar cliente como Inativo, Ativo
> com contrato, Lead (podem ser criadas novas marcações). Isso permitirá diminuir as listas para
> exibir só as ativas."
> **Decisão do PO (2026-07-20):** marcações gerenciáveis, **1 por cliente**.

## Resumo
Cliente ganha uma **marcação de status** vinda de um catálogo **gerenciável** (criar/editar nome e
cor), com **exatamente uma marcação vigente por cliente**. As listas de clientes ficam **filtráveis**
por marcação (ex.: mostrar só "Ativo com contrato").

## Contexto atual (AS-IS)
- Clientes: `pcm.clientes`, `ListaClientesPage.tsx`, domínio `clientes-crud.ts`.
- Grupos de clientes já existem (`pcm.cliente_grupos`, E01-S27) — conceito diferente (agrupamento de
  unidades), não confundir com marcação de status.

## Critérios de aceite

### AC-1: Catálogo de marcações gerenciável
- **Dado** um usuário com permissão (config)
- **Quando** cria/edita marcações (nome + cor)
- **Então** o catálogo é persistido (seed inicial: Inativo, Ativo com contrato, Lead) e reutilizável
  em todos os clientes.

### AC-2: Uma marcação por cliente
- **Dado** um cliente
- **Quando** o usuário define/troca a marcação
- **Então** o cliente tem **exatamente uma** marcação vigente; trocar substitui a anterior.

### AC-3: Filtro de listas por marcação
- **Dado** a lista de clientes
- **Quando** o usuário filtra por marcação (ex.: só "Ativo com contrato")
- **Então** a lista mostra só os clientes com aquela marcação; por padrão a lista pode ocultar
  Inativos/Leads para "diminuir a lista".

### AC-4: Badge visível
- **Dado** um cliente com marcação
- **Quando** aparece em lista/detalhe/360
- **Então** a marcação é exibida como badge com a cor definida.

## Casos de borda e erros
- Excluir uma marcação em uso → bloquear ou reatribuir (definir e cobrir por teste).
- Cliente sem marcação → estado neutro (sem badge), aparece nos filtros "todos".

## Fora de escopo (vinculante)
- Múltiplas marcações por cliente (decisão: 1 por cliente).
- Automação "inativa sozinho após N meses sem compra" (Fabrício citou, mas fica fora deste MVP —
  pode virar story futura; aqui é marcação manual + gerenciável).
- Segmentação para campanha/e-mail marketing (módulo Marketing, futuro).

## Rastreabilidade
- Migration: catálogo de marcações + coluna de marcação em `pcm.clientes`
- `apps/web/src/features/pcm/domain/clientes-crud.ts`, `pages/ListaClientesPage.tsx`
- Gestão do catálogo: Configurações (E01-S80)
- Badge na Visão 360: `VisaoClientePage.tsx`
