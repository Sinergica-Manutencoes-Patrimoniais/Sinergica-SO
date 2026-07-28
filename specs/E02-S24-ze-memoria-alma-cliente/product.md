---
name: product
description: PRD-lite da feature (por quê e para quem). Puxe ao abrir feature pequena/arquitetural.
alwaysApply: false
---

# Product — Memória e "alma" por cliente para o Zé

> **Tier:** arquitetural · **Status:** rascunho · **Dono:** Lucas / @prompt-engineer / @architect

## Problema
O Zé responde igual para todos os clientes, sem lembrar particularidades de cada condomínio (forma
de comunicação, histórico recente, preferências). O Fabrício quer que o Zé seja um **copiloto com
visão do todo** de cada cliente — que "entenda qual é a próxima visita", conheça o jeito de
comunicar daquele condomínio e use o histórico recente para responder de forma humanizada.

## Para quem
Operação da Sinérgica e os clientes (condomínios) atendidos pelo Zé no WhatsApp. Hoje cada cliente
tem um grupo; alguns conversam muito (dias de manutenção), outros quase nada.

## Resultado esperado / métrica de sucesso
- Métrica qualitativa: respostas do Zé contextualizadas ao cliente (usam histórico/particularidades).
- Baseline: prompt genérico igual para todos → Alvo: prompt base único **+ camada de memória/alma
  por cliente** injetada em runtime.

## Decisões de negócio travadas (reunião 2026-07-27)
- **Mesmo agente, mesmo prompt base** para todos os clientes. Ele **consome** a memória e a "alma"
  do cliente como dado de contexto — **não** é um agente com prompt próprio por condomínio.
- Retenção de memória (definida com o Fabrício):
  - Conversa **crua** (mensagens detalhadas): ~**1 mês** é suficiente.
  - **Resumo** dos últimos ~**2–3 meses**; o histórico mais antigo vira resumo e depois é descartado.
  - **Chamados ficam no banco** (rastreáveis para sempre); o **resumo de conversa** é efêmero.
  - O Zé consulta o histórico de chamados no banco sob demanda (ex.: "últimos 30 chamados"), não
    precisa carregar isso na memória de conversa.

## Goals
- Prompt base único + camada de dados (memória + alma) por cliente injetada no contexto.
- Política de retenção: janela crua ~1 mês, resumo ~2–3 meses, descarte do antigo.
- "Alma" do cliente: características/preferências de comunicação editáveis por cliente.

## Non-goals
- Um prompt/agente distinto por cliente (explicitamente descartado).
- Memória de longuíssimo prazo em conversa (o rastreio durável é o Chamado no banco).
- Trigger de quando responder (é E02-S25) e abertura de chamado (é E02-S23).

## Riscos / premissas
- **Risco:** custo/tamanho de contexto se a janela crua for grande — mitigado pela retenção de ~1 mês.
- **Risco:** vazamento de contexto entre clientes (memória de um cliente aparecer para outro) —
  isolamento por cliente é requisito de segurança.
- **Premissa:** resumo periódico (rolling summary) é gerado por LLM — versionar prompt e avaliar.
