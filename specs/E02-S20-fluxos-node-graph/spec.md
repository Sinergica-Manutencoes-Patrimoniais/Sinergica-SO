---
name: spec
description: Contrato — Fluxos em paridade node-graph (grafo de nós + recipes + logs), paridade heziomos.
alwaysApply: true
---

# Spec — Fluxos: paridade node-graph (recipes + logs)

> **Fonte da verdade.** Status: implementado localmente; pgTAP/UAT pendentes · Tier: Médio
> O Sinergica já tem um flow-builder `@xyflow` (E02-S07), mas em canvas linear (`campo/pergunta`). Fecha
> os gaps para o heziomos: grafo de nós ramificável, recipes (templates de fluxo) e logs de execução.

## Resumo
O construtor de fluxos passa a suportar grafo de nós com ramificação, um catálogo de recipes para
iniciar fluxos prontos, e uma visão de logs de execução por conversa.

## Critérios de aceite

### AC-1: Grafo de nós ramificável
- **Dado** o editor de fluxo
- **Quando** o usuário conecta nós com ramificações (condições/decisões), não só passos lineares
- **Então** o grafo persiste e valida (sem ciclo inválido/nó órfão) e é executável pelo agente

### AC-2: Recipes (templates de fluxo)
- **Dado** o catálogo de recipes
- **Quando** o usuário inicia um fluxo a partir de uma recipe
- **Então** o fluxo é pré-populado com os nós da recipe, editável a partir dali

### AC-3: Logs de execução
- **Dado** um fluxo que rodou em conversas
- **Quando** o usuário abre os logs
- **Então** vê o histórico de execução (nós percorridos, entradas/saídas) por conversa

### AC-4: Compatibilidade com fluxos existentes
- **Dado** fluxos lineares criados em E02-S07
- **Quando** abertos no novo editor
- **Então** continuam válidos e editáveis (migração/compat, sem perda)

## Casos de borda e erros
- Grafo com ciclo inválido/nó desconectado → validação impede publicar.
- Recipe removida → fluxos derivados dela continuam funcionando (cópia, não referência viva).

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Motores do agente (tool use/RAG) — `E02-S14`. Personas — E02-S06.

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `Flows.tsx`, `FlowEditor.tsx`, `FlowLogs.tsx`, `components/flow/*`.
- Âncora Sinergica: `FluxosManager`, `FlowBuilderCanvas`, `domain/fluxos.ts` (E02-S07).
