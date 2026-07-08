---
name: product
description: PRD-lite — Config de IA multi-persona (Zé + agente comercial) + base de conhecimento, tier Pequeno.
alwaysApply: false
---

# Product — Config: IA + Personas + Base de Conhecimento

> **Tier:** Pequeno · **Status:** aprovado · **Dono:** Claude (sessão Lucas)
> Épica: E02 — Atendimento · Zé.

## Problema
O prompt do Zé é uma string fixa no código (`pcm-ze-agent`) — ajustar tom/instrução exige editar
Edge Function e fazer deploy. Além disso, a Sinérgica vai operar um segundo agente de IA (para
contato comercial novo, ver `E02-S08`), e cada agente precisa do seu próprio prompt/base de
conhecimento — decisão do Lucas (2026-07-07): "é possível ter mais de uma persona de agente, cada
uma com a sua RAG e o seu prompt", para times internos diferentes (não multi-tenant externo).

## Decisões de escopo (@pm)
- **RAG simples, não vetorial.** "Base de conhecimento" é texto (FAQ/instruções) concatenado ao
  prompt do LLM — sem embeddings/pgvector nesta leva (decisão explícita do Lucas: "versão simples
  agora"). Migra pra busca vetorial depois se o volume de conteúdo justificar.
- **`tipo` da persona é fechado a `'chamados'|'comercial'`** (CHECK constraint), não texto livre —
  hoje só esses 2 fluxos têm código que sabe processá-los (criar OS vs. criar lead). Adicionar um
  3º tipo exige migration + código novo de qualquer forma, então não há ganho em deixar aberto
  agora (YAGNI).
- **Roteamento por instância, não multi-tenant.** `atendimento.instancias_agente` mapeia uma
  instância WhatsApp (Evolution) dedicada a uma persona — hoje só usado pelo agente comercial
  (`E02-S08`); o Zé continua roteado por `config_ze.group_jid` (inalterado).

## Para quem
Fabrício e colaboradores do escritório com permissão de leitura/escrita no módulo `atendimento`.

## Goals
- CRUD de personas (nome, tipo, prompt de sistema, base de conhecimento) na tela Config.
- CRUD de vínculo instância→persona (para o agente comercial de `E02-S08` saber qual persona usar
  quando uma mensagem chega numa instância dedicada).
- `pcm-ze-agent` passa a buscar o prompt do Zé em `atendimento.personas` (`tipo='chamados'`) em vez
  do texto fixo — migration `0041` já semeia essa persona com o texto atual, comportamento
  idêntico ao de antes até alguém editar via UI.

## Non-goals
- Busca vetorial/RAG real (embeddings) — ver decisão acima.
- Flow-builder visual (`E02-S07`, consome o resultado desta story mas é story separada).
- O próprio agente comercial rodando (`E02-S08`) — aqui só o schema/config; o agente que usa isso
  é a próxima story.

## Riscos / premissas
- Se a persona `tipo='chamados'` for desativada/apagada sem substituto, o Zé passa a falhar alto
  (erro 500 claro) em vez de voltar a um prompt hard-coded divergente — decisão consciente (ver
  comentário em `pcm-ze-agent/index.ts`, função `buscarPersona`).
