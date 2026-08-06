---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Guia SO atualizado (todos os módulos)

> **Fonte da verdade.** Origem: ponto da Aline via Lucas (2026-07-22, item 8c) + ajuste do Lucas
> (2026-08-04): **"atualize o SO inteiro, não só o Financeiro."** O Guia SO está desatualizado; o
> Financeiro é o pior caso (ainda como "protótipo"), mas a revisão é de **todos os módulos**. Cada
> opção precisa explicar como usar, para que serve e qual decisão/resultado apoia.

## Contexto de código
- Guias por módulo em `apps/web/src/features/guia/`: `VisaoGeralGuia.tsx`, `PcmGuia.tsx`,
  `AtendimentoGuia.tsx`, `FinanceiroGuia.tsx`, `PlanejadosGuia.tsx` (+ `FinanceiroGuia.test.ts`).
- O produto avançou muito desde que os guias foram escritos: PCM/Operação foi reestruturado
  (E01-S99/S114/S116-S119: Chamado→OS, board único, backlog aba), Atendimento/Zé evoluiu (E02),
  Financeiro saiu do protótipo (E04-S01 em produção). Os guias não acompanharam.
- Fonte de verdade do estado real: `docs/epics/ROADMAP.md` + navegação atual (`HomePage.tsx`).

## Resumo
Revisar **todos os guias de módulo** do SO pra refletir o estado real do produto. Financeiro é
prioridade (remover "protótipo"). Cada opção do guia deve dizer: **o que é, como usar, qual
decisão/resultado apoia** — não só listar recursos. Guia coerente com a navegação real (não citar
tela que não existe, não omitir tela que existe).

## Critérios de aceite

### AC-1: Todos os módulos revisados e coerentes com o estado real
- **Dado** cada guia de módulo (Visão Geral, PCM, Atendimento, Financeiro, Planejados)
- **Quando** o operador abre
- **Então** o conteúdo bate com o que o módulo realmente faz hoje (ROADMAP + nav), sem descrição
  obsoleta.

### AC-2: Financeiro não é mais "protótipo"
- **Dado** o Guia do Financeiro
- **Quando** o operador abre
- **Então** não há menção a "protótipo"/mock; descreve o que está entregue (fundação em produção) e
  marca o resto como "planejado".

### AC-3: Cada opção explica uso + decisão que apoia
- **Dado** qualquer seção de qualquer guia
- **Quando** o operador lê
- **Então** cada item diz o que é, como usar e qual decisão/resultado apoia (não só o nome do recurso).

### AC-4: Guia coerente com a navegação real
- **Dado** os guias
- **Quando** comparados com os menus/telas atuais
- **Então** não citam telas removidas (ex.: Relatório Diário/Mensal, Serviços) nem omitem as
  existentes (board Operação, Backlog aba, Anotações, etc.).

## Casos de borda e erros
- Módulo/recurso ainda não entregue: descrever como "planejado", nunca como disponível.
- Manter `FinanceiroGuia.test.ts` verde (ajustar asserts ao novo texto).
- Se algum módulo ainda está genuinamente "em construção" (sem tela): o guia diz isso, sem inventar.

## Fora de escopo
- Guia interativo/tour (é conteúdo textual).
- Documentar módulos de épicos não iniciados como se estivessem prontos.

## Rastreabilidade
- Código: todos os `apps/web/src/features/guia/*Guia.tsx`, `FinanceiroGuia.test.ts`.
- Fonte de verdade do estado: `docs/epics/ROADMAP.md`, navegação `HomePage.tsx`.
- ADRs relacionados: —
