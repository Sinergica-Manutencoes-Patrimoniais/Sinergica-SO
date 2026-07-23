---
name: adr-0013-roteamento-atendimento-por-instancia-evolution
description: ADR para resolver persona pela instância Evolution antes do tipo do agente.
alwaysApply: false
---

# ADR-0013 — Roteamento do Atendimento por instância Evolution

## Status
Aceita em 2026-07-22.

## Contexto
Um servidor Evolution atende múltiplos números. Resolver a persona apenas por `tipo` faz instâncias
distintas compartilharem prompt, conhecimento e regras, contrariando operação por time.

## Decisão
`instance_id` recebido no webhook é chave primária de roteamento. Vínculo ativo em
`atendimento.instancias_agente` resolve a persona efetiva. `persona.tipo` decide somente o caso de
uso (`chamados` ou `comercial`). `config_ze` continua resolvendo Cliente PCM e serve como fallback
temporário quando a instância ainda não foi vinculada.

Credenciais do servidor Evolution permanecem globais. Não haverá segredo por instância.

## Consequências
- Duas instâncias usam prompts, modelos, RAG e regras independentes.
- Configurar vínculo da instância vira pré-requisito operacional.
- Compatibilidade legada permanece, mas não pode sobrepor vínculo explícito.
- Roteamento A/B vira gate obrigatório de teste.

