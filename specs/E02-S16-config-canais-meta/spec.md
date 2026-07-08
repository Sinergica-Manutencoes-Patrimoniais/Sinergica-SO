---
name: spec
description: Contrato — abas de canais Meta (Meta WA + Templates + Instagram + Messenger), paridade heziomos.
alwaysApply: true
---

# Spec — Config de canais Meta: WhatsApp Cloud + Templates + Instagram + Messenger

> **Fonte da verdade.** Status: rascunho · Tier: Médio
> Quatro abas do heziomos ausentes. Instagram/Messenger hoje são só valores de enum
> (`conversas.ts`), sem config. **Manual (Lucas):** apps/tokens Meta são credenciais externas.

## Resumo
Adiciona as abas de conexão e gestão dos canais Meta: WhatsApp Cloud API (Meta WA), Templates de
WhatsApp, Instagram e Messenger — cada uma com config/conexão persistida por cliente.

## Critérios de aceite

### AC-1: Conexão Meta WA
- **Dado** a aba Meta WA
- **Quando** o usuário informa credenciais/identificadores do WhatsApp Cloud (phone number id, WABA, token via secret)
- **Então** a conexão é salva (segredos fora do client) e o status de conexão é exibido

### AC-2: Templates de WhatsApp
- **Dado** a aba Templates
- **Quando** o usuário lista/cria/edita templates aprovados
- **Então** os templates persistem e ficam disponíveis para envio (inbox/fluxos)

### AC-3: Instagram e Messenger conectáveis
- **Dado** as abas Instagram e Messenger
- **Quando** o usuário conecta a conta/página
- **Então** a config persiste e o canal passa a poder receber/enviar (inbox humano)

### AC-4: Gating por papel
- **Dado** usuário sem permissão de config
- **Quando** acessa/salva
- **Então** é bloqueado (RLS + gate de UI)

## Casos de borda e erros
- Token inválido/expirado → status de conexão "erro", não crash; mensagem clara.
- Template com placeholder inválido → validação impede salvar.
- Segredos nunca no client (Vault/edge) — SPEC_DEVIATION se algum vazar para o front.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Conexão Evolution — `E02-S19`. Automação de comentários IG — `E02-S17`.
- Fornecer os valores dos tokens Meta (ação manual do Lucas).

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `MetaWATab`, `WhatsappTemplatesTab`, `InstagramTab`, `MessengerTab`.
- Âncora Sinergica: `AtendimentoConfigPage.tsx`, `domain/conversas.ts` (canais).
