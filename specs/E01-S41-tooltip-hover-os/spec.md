---
name: spec
description: Contrato — tooltip de hover reutilizável nos cards de OS + esclarecimento do CH-XXXX.
alwaysApply: true
---

# Spec — Tooltip de hover em OS (Lista/Kanban/Timeline/Backlog GUT) + CH-XXXX

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Feedback de teste manual do Lucas (2026-07-09, pontos 1.a e 3): passar o mouse num card de tarefa
> (Lista/Kanban/Timeline/Backlog GUT) deveria mostrar descrição/detalhes sem precisar abrir o painel
> lateral; e não estava claro o que o número `CH-XXXX` significa.

## Resumo
Componente `Tooltip` reutilizável (CSS puro, sem lib nova), plugado nos cards das 4 telas mostrando
descrição/detalhes em hover (e em foco de teclado). O `CH-XXXX` ganha um tooltip explicando que é a
numeração interna do PCM, não um ticket/task do Auvo.

## Critérios de aceite

### AC-1: Hover mostra descrição sem abrir o painel
- **Dado** um card de OS em Lista, Kanban, Timeline ou Backlog GUT
- **Quando** o mouse fica sobre o card por ~300ms
- **Então** um tooltip aparece com a descrição (e, quando existir, dados de `auvo_detalhes`)

### AC-2: Acessível por teclado
- **Dado** o mesmo card
- **Quando** ele recebe foco (Tab)
- **Então** o mesmo tooltip aparece, sem depender de mouse

### AC-3: Não recorta em containers com scroll
- **Dado** o Kanban (colunas com `overflow-x/y-auto`)
- **Quando** o tooltip abre num card perto da borda
- **Então** o tooltip não é cortado pelo container — usa posicionamento calculado por
  `getBoundingClientRect()`, não `overflow: visible` do container

### AC-4: CH-XXXX explicado
- **Dado** o número `CH-XXX` exibido (lista/painel de detalhe)
- **Quando** o mouse passa sobre ele
- **Então** um tooltip explica: "Numeração interna do PCM (Chamado) — não é o ticket/task do Auvo."

## Casos de borda e erros
- Card sem descrição/detalhes: tooltip não aparece (não mostra vazio).

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Mudar a lógica de geração do `CH-XXX` (`supabase-ordem-servico-adapter.ts:proximoNumero`) — só copy.
- Tooltip em outras partes do app fora das 4 telas listadas.

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Arquivos-âncora: novo `apps/web/src/components/ui/Tooltip.tsx`,
  `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx`,
  `apps/web/src/features/pcm/components/OsKanbanView.tsx`,
  `apps/web/src/features/pcm/components/OsTimelineView.tsx`,
  `apps/web/src/features/pcm/components/OsCalendarioView.tsx`,
  `apps/web/src/features/pcm/pages/BacklogGutPage.tsx`.
