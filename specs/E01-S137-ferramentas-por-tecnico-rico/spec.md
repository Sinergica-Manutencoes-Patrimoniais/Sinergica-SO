---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Ferramentas por Técnico: todos os técnicos, histórico e atribuição no modal

> **Fonte da verdade.** Origem: Lucas (2026-08-04, item 1, com print). "Gostaria de ver todos os
> técnicos e trazer as informações deles, ver o histórico de alocação de ferramenta, e ter opção de
> atribuir ferramentas dentro do modal aberto no estilo de selecionar e enviar para o lado."

## Contexto de código
- `pages/FerramentasPorTecnicoPage.tsx` (E01-S113, hub técnico + cliente; abas "Por Técnico"/"Por
  Cliente"). Hoje a atribuição é uma linha com 3 selects (ferramenta/unidade/técnico) + "Atribuir",
  e a lista mostra técnicos com "Histórico". O print mostra técnico "sem unidade atribuída".
- Dado: `ferramenta_unidades` (posse por unidade, E01-S63/S131), movimentações
  (`MovimentacaoFerramentaItem`: atribuição/devolução/baixa), funcionários (`FuncionarioItem`).

## Resumo
A aba "Por Técnico" passa a listar **todos os técnicos** (não só os com unidade), com um resumo de
cada. Clicar num técnico abre um **modal** com: informações dele, ferramentas atuais em posse, e o
**histórico de alocação** completo. No mesmo modal, atribuir ferramentas via **transfer-list**
(dual-list: unidades disponíveis à esquerda → seleciona → "enviar pro lado" → confirma).

## Critérios de aceite

### AC-1: Lista todos os técnicos
- **Dado** a aba "Por Técnico"
- **Quando** carrega
- **Então** mostra **todos os técnicos ativos**, cada um com resumo (nº de ferramentas em posse,
  divergência com Auvo se houver) — inclusive quem está sem nenhuma unidade.

### AC-2: Modal com info + histórico
- **Dado** um técnico na lista
- **Quando** o operador clica
- **Então** abre um modal com os dados do técnico, as **ferramentas atuais** em posse e o **histórico
  de alocação** (movimentações: atribuição/devolução/baixa, com data e ferramenta) — histórico nunca
  sobrescrito (PCM é dono; Auvo é só sinal de conferência).

### AC-3: Atribuir por transfer-list dentro do modal
- **Dado** o modal aberto de um técnico
- **Quando** o operador quer atribuir ferramentas
- **Então** vê uma lista de **unidades disponíveis** e, no estilo "selecionar e enviar pro lado"
  (dual-list), move as escolhidas para o lado do técnico e confirma — atribui várias de uma vez.

### AC-4: Devolver/retirar no modal
- **Dado** ferramentas atuais em posse no modal
- **Quando** o operador remove uma (envia de volta pro lado "disponível" / devolve)
- **Então** registra a devolução (reusa fluxo E01-S63), sem quebrar o histórico.

### AC-5: Consistência
- **Dado** uma atribuição feita no modal
- **Quando** confirma
- **Então** a unidade sai de "disponível", entra na posse do técnico, e o histórico registra o
  evento — mesma regra do fluxo atual (unidade só disponível pode ser atribuída).

## Casos de borda e erros
- Unidade já atribuída a outro técnico: não aparece como disponível pra transferir (evita conflito).
- Sem permissão de escrita: modal fica read-only (vê info/histórico, não atribui).
- Técnico sem Auvo user: atribui no PCM normalmente; divergência é só alerta de leitura.
- Muitas unidades disponíveis: busca/filtro na lista do transfer-list.

## Fora de escopo
- Aba "Por Cliente" (continua como está, E01-S106/S113).
- Reserva por período (E01-S64) — atribuição direta aqui, reserva é outro fluxo.

## Rastreabilidade
- Código: `pages/FerramentasPorTecnicoPage.tsx` (lista todos + modal + transfer-list),
  `domain/ferramenta-unidades.ts`, `infrastructure/supabase-ferramenta-unidades-adapter.ts`,
  `domain/funcionarios.ts`. Componente de transfer-list novo em `components/` ou `ui/`.
- Estende: E01-S63 (unidades/movimentação), E01-S113 (hub técnico), E01-S131 (item-cêntrico).
- ADRs relacionados: —
