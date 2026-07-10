---
name: spec
description: Contrato — filtros de técnico/categoria/data em Ordens de Serviço, KPIs recalculam sobre o filtrado.
alwaysApply: true
---

# Spec — Filtros avançados em Ordens de Serviço

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Feedback de teste manual do Lucas (2026-07-09, ponto 2): faltam filtros de técnico/categoria/data em
> Ordens de Serviço. Decisão do Lucas (AskUserQuestion nesta sessão): os KPIs do topo recalculam sobre o
> conjunto filtrado, não o total geral.

## Resumo
`OrdensServicoPage.tsx` ganha filtros de técnico, categoria e intervalo de data (além dos já existentes
de busca livre e status), combináveis entre si, aplicados client-side (mesma base de dado já carregada
por `buscarTodasOrdens`). Os KPIs do topo recalculam sobre o conjunto já filtrado.

## Critérios de aceite

### AC-1: Filtro por técnico
- **Dado** um técnico selecionado no novo filtro
- **Quando** aplicado
- **Então** só aparecem OS com esse `tecnicoFuncionarioId`

### AC-2: Filtro por categoria
- **Dado** uma categoria selecionada
- **Quando** aplicada
- **Então** só aparecem OS dessa `categoria`

### AC-3: Filtro por intervalo de data
- **Dado** uma data de início e/ou fim
- **Quando** aplicado
- **Então** só aparecem OS com `createdAt` dentro do intervalo (inclusive)

### AC-4: Filtros combinam entre si
- **Dado** técnico + categoria + data + busca + status preenchidos ao mesmo tempo
- **Quando** aplicados
- **Então** o resultado é a interseção de todos (E lógico), refletido nas 4 views (Lista/Kanban/
  Timeline/Calendário)

### AC-5: KPIs refletem o filtro
- **Dado** qualquer combinação de filtro ativa
- **Quando** aplicada
- **Então** os 6 KPIs do topo (Total/Abertas/Planejamento/Execução/Finalizadas/Críticas) recalculam
  sobre o conjunto filtrado, não o total geral

### AC-6: Limpar filtros
- **Dado** filtros aplicados
- **Quando** o usuário clica em "Limpar filtros"
- **Então** os 5 filtros (busca, status, técnico, categoria, data) resetam de uma vez

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Paginação/agregação 100% server-side — documentado e adiado em **E01-S44**.
- Seleção múltipla/ação em lote — **E01-S43**.

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Arquivos-âncora: `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx`,
  `apps/web/src/features/pcm/domain/ordens-servico.ts`.
