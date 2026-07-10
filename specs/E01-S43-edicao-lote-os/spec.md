---
name: spec
description: Contrato — seleção múltipla + troca de status em lote nas views Lista/Kanban de OS.
alwaysApply: true
---

# Spec — Edição em lote de Ordens de Serviço

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Feedback de teste manual do Lucas (2026-07-09, ponto 2): "legal conseguir fazer ajustes em lote das
> tarefas". Hoje trocar status é um select por card, um de cada vez.

## Resumo
Views Lista e Kanban de `OrdensServicoPage.tsx` ganham checkbox de seleção múltipla + uma barra de ação
em lote (aparece quando há seleção) pra trocar o status de todas as OS selecionadas de uma vez. Falha
isolada numa OS não trava as demais.

## Critérios de aceite

### AC-1: Selecionar múltiplas OS
- **Dado** a view Lista ou Kanban
- **Quando** o usuário marca checkboxes de N OS
- **Então** uma barra de ação em lote aparece mostrando "N selecionadas"

### AC-2: Aplicar novo status em lote
- **Dado** N OS selecionadas
- **Quando** o usuário escolhe um status na barra e confirma
- **Então** todas as N OS são atualizadas para esse status

### AC-3: Falha parcial não trava o lote
- **Dado** N OS selecionadas, uma delas falha ao atualizar (ex.: RLS/rede)
- **Quando** a ação em lote roda
- **Então** as demais N-1 confirmam normalmente e a falha aparece nomeada (qual OS, qual erro) — não
  aborta as outras

### AC-4: Seleção limpa ao trocar contexto
- **Dado** uma seleção ativa
- **Quando** o usuário troca de view (Lista↔Kanban↔Timeline↔Calendário) ou recarrega a lista
- **Então** a seleção é limpa

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Seleção em Timeline/Calendário (visões de posição temporal, não fazem sentido pra seleção em massa).
- Outras ações em lote além de status (ex.: trocar técnico em lote) — só status por agora.
- RPC de banco nova — reusa `alterarStatus` já existente, um `UPDATE` por OS via `Promise.allSettled`.

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Depende de: E01-S42 (mesma tela, filtros já existentes).
- Arquivos-âncora: `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx`,
  `apps/web/src/features/pcm/components/OsKanbanView.tsx`,
  `apps/web/src/features/pcm/application/hub-os.ts`.
