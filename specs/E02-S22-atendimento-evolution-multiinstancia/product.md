---
name: product
description: PRD do runtime multi-instância do Atendimento via Evolution.
alwaysApply: false
---

# Product — Atendimento Evolution multi-instância operacional

> **Tier:** arquitetural · **Status:** aprovado · **Dono:** @pm

## Problema
O Atendimento conecta várias instâncias no mesmo servidor Evolution, mas o runtime não respeita o
vínculo instância→persona no fluxo de chamados. Regras de transferência são parcialmente ignoradas,
o webhook não está pronto para o contrato atual da Evolution e uma conversa sem condomínio não pode
ser vinculada pelo atendente a um cliente PCM existente.

## Para quem
Times internos de PCM e Comercial, cada um atendendo por um número WhatsApp e agente próprios, com
Inbox humano compartilhado.

## Resultado esperado / métrica de sucesso
- Duas instâncias simultâneas roteiam 100% das mensagens para suas personas, sem cruzamento.
- Zero resposta automática depois de handoff.
- 100% das conversas vinculáveis a um cliente PCM por operação atômica e auditável.
- Envio e recepção de texto passam em teste de contrato contra a versão Evolution adotada.

## Goals
- Uma URL/API key Evolution, múltiplos `instance_id`.
- Persona, modelo, prompt, conhecimento e regras efetivos por instância.
- Handoff manual e automático visível no Inbox.
- Vínculo manual conversa/contato→cliente PCM.
- Webhook autenticado, limitado, idempotente e sem eco de mensagens próprias.

## Non-goals
- Servidores Evolution ou API keys diferentes por instância.
- Agentes externos ao OpenRouter.
- Cadastro completo de clientes pelo Inbox.
- Trocar Evolution por Meta Cloud API.

## Riscos / premissas
- As instâncias pertencem ao mesmo servidor Evolution configurado em `EVOLUTION_API_URL`.
- Cada instância ativa possui no máximo uma persona ativa.
- O atendente que vincula cliente possui `atendimento:escrita`.

