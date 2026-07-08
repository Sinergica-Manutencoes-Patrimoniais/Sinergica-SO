---
name: spec
description: Contrato — aba "Conhecimento" com base RAG (entradas + relevância), paridade heziomos.
alwaysApply: true
---

# Spec — Aba de config: Conhecimento / Base RAG

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno-Médio
> Hoje só existe um campo free-text "Base de conhecimento" por persona (`PersonasList.tsx`). Promove a
> uma base real com entradas e recuperação por relevância, ligada ao toggle RAG de `E02-S14`.

## Resumo
A aba "Conhecimento" gerencia entradas da base (CRUD) que o agente recupera por relevância (RAG) durante
a resposta, substituindo o texto solto por conhecimento estruturado e indexado.

## Critérios de aceite

### AC-1: CRUD de entradas de conhecimento
- **Dado** a aba Conhecimento
- **Quando** o usuário cria/edita/desativa uma entrada (título + conteúdo + tags/escopo)
- **Então** persiste (tabela + RLS FORCE) e a contagem de "entradas ativas" reflete

### AC-2: Recuperação por relevância (RAG)
- **Dado** a base com entradas e o toggle RAG ligado
- **Quando** o agente responde a uma pergunta
- **Então** as entradas entram por relevância à pergunta (embedding/busca), não por prioridade fixa

### AC-3: Gating por papel
- **Dado** usuário sem permissão
- **Quando** acessa/edita
- **Então** é bloqueado (RLS + gate de UI)

## Casos de borda e erros
- RAG desligado → base não é consultada, mas entradas permanecem editáveis.
- Entrada sem conteúdo → validação impede salvar.
- Sem entradas ativas → recuperação retorna vazio, agente responde sem contexto extra.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- O toggle RAG em si — `E02-S14`. Templates de mensagem — `E02-S16`.

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `KnowledgeBaseTab`.
- Âncora Sinergica: `AtendimentoConfigPage.tsx`, `PersonasList.tsx` (campo atual a promover).
