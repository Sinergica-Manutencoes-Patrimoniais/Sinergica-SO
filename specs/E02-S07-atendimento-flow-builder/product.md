---
name: product
description: PRD-lite — editor visual de fluxo de qualificação por persona (@xyflow/react), tier Pequeno.
alwaysApply: false
---

# Product — Config: Flow-builder visual

> **Tier:** Pequeno · **Status:** aprovado · **Dono:** Claude (sessão Lucas)
> Épica: E02 — Atendimento · Zé. Depende de `E02-S06` (`atendimento.personas`).

## Problema
O agente comercial (`E02-S08`) precisa qualificar um contato novo (orçamento, urgência, tipo de
serviço…) antes de criar o lead. Sem um jeito de configurar ESSE roteiro de perguntas fora do
código, cada ajuste de "o que perguntar" viraria deploy de Edge Function.

## Decisão de escopo (@pm)
Recomendação original (ver plano da épica) era não abrir esta story — o caso de uso do Zé sozinho
é estreito demais pra justificar um editor visual. **Lucas decidiu construir mesmo assim**,
explicitamente, no contexto de já existir um 2º agente (comercial) com necessidade real de um
roteiro configurável de qualificação — decisão registrada, não um desvio silencioso da
recomendação anterior.

**Modelo de execução escolhido: checklist sequencial, não árvore de decisão.** O fluxo é uma lista
ordenada de passos (campo a coletar + pergunta + obrigatório), não uma máquina de estados com
ramificação condicional. `@xyflow/react` é usado como **editor visual** (nós arrastáveis,
conectados em sequência) — as conexões são sempre lineares (auto-geradas pela ordem), o usuário não
desenha arestas arbitrárias. Motivo: o runtime (`E02-S08`) é um agente de IA conversacional, não um
intérprete de state machine — dar a ele uma lista do que precisa coletar (deixando a ordem/frase
exata da pergunta a cargo do LLM) é mais robusto do que forçar uma árvore rígida, e implementar um
verdadeiro editor de grafo arbitrário seria um esforço muito maior sem consumidor real que precise
de ramificação.

## Para quem
Fabrício e colaboradores do escritório com permissão de leitura/escrita no módulo `atendimento`.

## Goals
- Aba "Fluxos" na tela Config: criar um fluxo vinculado a uma persona, adicionar/editar/remover
  passos (campo, pergunta, obrigatório) num canvas visual, arrastar pra reorganizar, salvar.

## Non-goals
- Ramificação condicional / múltiplos caminhos — ver decisão acima.
- Execução determinística estrita do fluxo pelo agente (isso é `E02-S08`; aqui só o editor +
  schema).

## Riscos / premissas
- Posição dos nós (`x`/`y`) é só cosmética — não persistida com garantia de layout perfeito entre
  sessões diferentes (é um ponto de partida, o usuário reorganiza se quiser).
