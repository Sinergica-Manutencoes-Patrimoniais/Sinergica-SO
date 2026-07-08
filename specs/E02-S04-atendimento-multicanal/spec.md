---
name: spec
description: Contrato — Inbox multi-canal humano.
alwaysApply: true
---

# Spec — Inbox Multi-canal Humano

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno

## Critérios de aceite

### AC-1: Banco aceita Instagram e Messenger
- **Dado** uma linha em `atendimento.conversas`
- **Quando** `canal` é `instagram` ou `messenger`
- **Então** o check constraint aceita a linha, mantendo valores fora da lista negados

### AC-2: Inbox mostra o canal
- **Dado** conversas de WhatsApp, Instagram e Messenger
- **Quando** o Inbox lista as conversas
- **Então** cada item mostra o canal correto

### AC-3: IA fica restrita ao WhatsApp
- **Dado** uma conversa de Instagram ou Messenger
- **Quando** a conversa é aberta
- **Então** a UI não mostra "Responder com IA agora" nem "Devolver ao Zé"; o adapter também
  recusa acionamento direto de IA nesses canais

### AC-4: Dashboard agrupa mix de canais
- **Dado** conversas de múltiplos canais
- **Quando** o dashboard carrega
- **Então** o bloco "Mix de canais" conta WhatsApp, Instagram e Messenger separadamente

## Fora de escopo
- Ver `product.md` → Non-goals.
