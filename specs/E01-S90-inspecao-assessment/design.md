---
name: design-E01-S90-inspecao-assessment
description: Design — Inspeção como documento de assessment do cliente; questionário do Auvo vira itens de inspeção, cada item deriva Chamado/Backlog/OS.
alwaysApply: false
---

# Design — Inspeção como assessment (questionário Auvo → itens → destino)

> **Tier arquitetural.** Novo fluxo cross-integração (Auvo questionário → PCM). Aprovar antes de codar.

## Problema
A **Inspeção** é o **documento de assessment do cliente** (feito no início do contrato, em
alterações ou anualmente) que lista o estado do condomínio/cliente. Ela é feita com base num
**questionário que já existe no Auvo**, onde o técnico/engenheiro inputa informações e imagens. Cada
**resposta do questionário** deve chegar ao PCM como um **item da inspeção**, e cada item pode
derivar para: um **Chamado**, um **Backlog** ou uma **OS**. A decisão de destino é feita com o
cliente (Sinérgica executa, terceiriza — ex.: construtora em garantia — ou o cliente resolve).

## Contexto atual (AS-IS)
- Já existe módulo de **Inspeções ABNT NBR 16747** (E01-S73) e Inspeções/Laudos SPDA (E01-S19) —
  `InspecoesPage.tsx`, domínio `inspecoes-laudos.ts`, adapter `supabase-qualidade-adapter.ts`.
- A investigação de E01-S79 (ver `docs/STATE.md`) confirmou: **o conceito de "assessment de
  contrato" nunca foi implementado** no repo antigo — é feature nova, reusando o padrão técnico das
  Inspeções ABNT como base, mas **conceitualmente separada** (doc de estado do cliente, não checklist
  NBR).
- Questionário no Auvo: o webhook de conclusão de tarefa já traz questionário/checklist preenchido
  (E01-S15, `pcm.auvo_task_snapshots`). Auvo tem "questionário" como tipo de tarefa (visto na call).
- Chamado (E01-S88), Backlog (E01-S83), OS (`pcm.ordens_servico`) já existem/serão criados.

## Decisões
### D1 — Inspeção-assessment é entidade própria, reusa padrão técnico de Inspeções ABNT
Criar (ou estender) uma inspeção do tipo **assessment**, ligada a um cliente/contrato, com data e
motivo (início / alteração de contrato / anual). Reusa a mecânica de itens+foto das Inspeções
existentes, mas é um tipo/entidade distinta conceitualmente.

### D2 — Cada resposta do questionário Auvo = 1 item de inspeção
O questionário preenchido no Auvo chega via webhook/snapshot (E01-S15). Um **mapeador** transforma
cada resposta (com imagens) em um **item de inspeção** no PCM. Idempotente por (inspeção, questão).

### D3 — Item deriva Chamado / Backlog / OS
Cada item tem um **destino** decidido pelo usuário: gerar **Chamado** (E01-S88 — que por sua vez pode
virar OS/backlog), ir direto ao **Backlog** (E01-S83), ou gerar **OS**. O item guarda a decisão e o
responsável (Sinérgica / terceiro / cliente). Fecha o loop "assessment → plano de ação".

### D4 — Inspeção é o documento de estado do cliente (aparece na Visão 360)
A inspeção-assessment fica acessível na **Visão 360 do Cliente** como o documento de estado vigente
(liga o `useInspecoesByClient` que no repo antigo era dead code — aqui nasce conectado).

## Alternativas descartadas
- **Reaproveitar código do repo antigo** — não existe (confirmado na investigação de E01-S79).
- **Tratar assessment como uma inspeção ABNT comum** — mistura conceitos (checklist NBR ≠ assessment
  de contrato). Descartado (tipo separado).

## Impacto
- Migration: tipo/entidade de inspeção-assessment + itens com destino/responsável.
- Mapeador questionário Auvo → itens (reusa snapshot E01-S15).
- Integrações: gera Chamado (S88) / Backlog (S83) / OS.
- Visão 360: seção de assessment.

## Riscos
- Formato do questionário Auvo variável → mapeador tolerante, item "não mapeado" nunca se perde.
- Dependência de S88 (Chamado) e S83 (Backlog) — sequenciar.
