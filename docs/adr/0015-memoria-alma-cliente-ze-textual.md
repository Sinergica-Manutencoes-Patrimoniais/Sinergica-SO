---
name: adr-0015-memoria-alma-cliente-ze-textual
description: Memória do Zé por cliente = prompt base único + alma + resumo textual rolante; RAG/embeddings adiado até evals exigirem.
alwaysApply: false
---

# ADR-0015 — Memória do Zé por cliente via alma + resumo textual (RAG adiado)

**Status:** Proposto
**Data:** 2026-07-28
**Decisores:** Lucas Azevedo, @prompt-engineer, @architect
**Relacionados:** E02-S24 (spec/design/product), ADR-0011 (tenancy portal cliente / claim cliente_id),
ADR-0002 (detecção determinística Zé)

## Contexto
O Zé precisa de contexto por cliente (particularidades de comunicação + histórico recente) sem
multiplicar prompts. Reunião de 2026-07-27: **mesmo prompt base** para todos, consumindo memória/alma
do cliente como dado. Retenção definida com o Fabrício: janela crua ~1 mês, resumo ~2–3 meses,
descarte do antigo; chamados ficam no banco (rastreio durável).

## Decisão
- Contexto do Zé = **prompt base único** + **alma(cliente)** + **memória(cliente)**, composto em
  runtime. Não há prompt/agente por cliente.
- Memória = **janela crua** (~1 mês, do histórico já existente) + **resumo textual rolante**
  (~2–3 meses, regenerado por LLM); conteúdo cru antigo é descartado por retenção.
- **Estratégia textual (sem RAG/embeddings) no MVP.** Vector store/RAG fica **adiado** e só será
  adotado se as evals demonstrarem que o resumo textual é insuficiente — o que exigirá novo ADR.
- Isolamento estrito por `cliente_id`; memória de um cliente nunca entra no contexto de outro.
- Rastreio durável de trabalho continua sendo o **Chamado** (`pcm.chamados`), consultado sob demanda
  por tool do agente, fora da memória de conversa.

## Alternativas consideradas
| Alternativa                          | Prós | Contras | Por que (não) escolhida |
|--------------------------------------|------|---------|-------------------------|
| A (escolhida) base + alma + resumo textual | simples, barato, mantível, alinhado ao pedido | resumo pode perder nuance | escolhida — suficiente para o MVP |
| B prompt/agente por cliente          | máxima personalização | inviável de manter; contradiz o pedido | rejeitada |
| C RAG/embeddings por cliente já no MVP | recall fino | complexidade/custo sem evidência de ganho | adiada até evals |

## Consequências
**Positivas:**
- Personalização barata e mantível; um só prompt base para evoluir.
- Custo de LLM limitado pela retenção curta.
- Rastreio durável preservado no banco (Chamado), desacoplado da memória efêmera.

**Negativas / trade-offs aceitos:**
- Resumo textual pode perder nuance vs. RAG — aceito no MVP, revisável por evals.
- Job de resumo é uma peça de infra extra (cron/edge) a operar e observar.
