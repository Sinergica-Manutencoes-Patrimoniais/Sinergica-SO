---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Filtro por cliente na tela de Chamados

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 4 (nota deixada pelo Fabrício no GitHub).

## Resumo
Adicionar filtro por cliente na lista/board de Chamados, para o operador ver só os chamados de um
cliente específico.

## Critérios de aceite

### AC-1: Filtrar por cliente
- **Dado** a tela de Chamados com chamados de vários clientes
- **Quando** o operador seleciona um cliente no filtro
- **Então** a lista/board mostra apenas os chamados daquele cliente.

### AC-2: Limpar filtro
- **Dado** um filtro de cliente ativo
- **Quando** o operador limpa a seleção
- **Então** todos os chamados voltam a ser exibidos.

### AC-3: Combinar com filtros/estado existentes
- **Dado** outros filtros ou colunas de status já presentes na tela
- **Quando** o filtro de cliente é aplicado
- **Então** ele compõe com os demais (AND), sem quebrar a paginação/contagem exibida.

## Casos de borda e erros
- Cliente sem chamados → lista vazia com estado "nenhum chamado" (não erro).
- Muitos clientes → o seletor deve ser buscável (autocomplete), não um dropdown gigante.

## Fora de escopo
- Filtros por técnico, data ou criticidade (podem vir depois; não nesta story).

## Rastreabilidade
- Código: `apps/web/src/features/pcm/pages/ChamadosPage.tsx`.
- ADRs relacionados: —
