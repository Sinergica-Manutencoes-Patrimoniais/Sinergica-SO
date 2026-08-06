---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — ID do Auvo visível na tela do Chamado/OS

> **Fonte da verdade.** Origem: pedido do Lucas (2026-08-04, item 1). "Quando sincronizar e criar
> a task no Auvo, quero que ela seja exibida (o id), na tela do chamado, trocar de `synced` para o
> ID Auvo."

## Contexto de código
- `OrdemServicoOperacional.auvoTaskId: number | null` já existe (`domain/ordens-servico.ts`). O
  card do Kanban já mostra `Auvo #{auvoTaskId}` (E01-S117 AC-3, `OsKanbanView.tsx` L227).
- O que ainda mostra estado genérico é o **painel de detalhe** (`DetalheOs` em
  `OrdensServicoPage.tsx` ~L977 usa `Task ${auvoTaskId}`) e principalmente a **tela do Chamado**
  (`ChamadoPainel.tsx`, E01-S118 T7), que hoje não exibe o vínculo com a task Auvo — o operador só
  vê que "sincronizou", sem o número que permite achar a OS no Auvo.
- Deep-link do Auvo já é usado no projeto (`osDeepLink`, E01-S116). A URL da tarefa Auvo segue
  `https://app.auvo.com.br/informacoes/tarefa/<taskID>` (ver exemplos do item 7 do Lucas).

## Resumo
Onde hoje aparece um estado genérico ("synced"/"Sincronizado"), quando `auvoTaskId` existir, mostrar
o **ID real do Auvo** (`Auvo #<id>`) como badge clicável que abre a tarefa no Auvo. Vale para o
painel de detalhe da OS **e** para a tela do Chamado (`ChamadoPainel`). Sem task Auvo ainda: mostra
o estado neutro atual ("Sem OS no Auvo"), nunca um "synced" mentiroso.

## Critérios de aceite

### AC-1: ID do Auvo no lugar de "synced" (OS com task)
- **Dado** um Chamado/OS que já gerou task no Auvo (`auvoTaskId !== null`)
- **Quando** o operador abre o painel de detalhe/tela do Chamado
- **Então** vê `Auvo #<id>` (o número real), não um rótulo genérico "synced"/"Sincronizado".

### AC-2: Badge é deep-link pro Auvo
- **Dado** o `Auvo #<id>` exibido
- **Quando** o operador clica
- **Então** abre a tarefa correspondente no Auvo em nova aba (`app.auvo.com.br/informacoes/tarefa/<id>`).

### AC-3: Sem task Auvo → estado neutro, nunca "synced"
- **Dado** um Chamado/OS ainda sem task no Auvo (`auvoTaskId === null`)
- **Quando** o operador abre o painel
- **Então** vê um estado neutro claro ("Sem OS no Auvo") — nunca "Sincronizado".

## Casos de borda e erros
- OS legada só com `numero` `OS-XXXX` e sem `auvoTaskId`: cai no AC-3 (estado neutro).
- `auvoTaskId` presente mas 0/negativo (não deveria): trata como ausente (AC-3), não gera link quebrado.

## Fora de escopo
- Editar/re-sincronizar a task (é a E01-S121).
- Mostrar status de execução detalhado do Auvo no painel (já coberto por abas ricas E01-S70).

## Rastreabilidade
- Código: `components/ChamadoPainel.tsx`, `pages/OrdensServicoPage.tsx` (`DetalheOs`),
  `domain/ordens-servico.ts` (helper de deep-link, se extraído).
- Estende: E01-S117 (Auvo #id no card), E01-S116 (deep-link).
- ADRs relacionados: —
