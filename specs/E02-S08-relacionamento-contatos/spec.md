---
name: spec
description: Contrato — base única de contatos e timeline.
alwaysApply: true
---

# Spec — Base Única de Contatos

> **Fonte da verdade.** Status: aprovado · Tier: Arquitetural

## Critérios de aceite

### AC-1: Webhook resolve contato por WhatsApp
- **Dado** mensagem recebida em `pcm-whatsapp-webhook`
- **Quando** a RPC registra a mensagem de entrada
- **Então** existe `relacionamento.contatos`, `identidades_contato(tipo='whatsapp')` e a conversa
  fica com `contato_id`

### AC-2: Reentrega não duplica contato
- **Dado** a mesma identidade WhatsApp já existe
- **Quando** outra mensagem chega do mesmo JID
- **Então** a mesma linha de contato é reutilizada

### AC-3: Lead comercial aponta para contato
- **Dado** o agente comercial cria `comercial.leads` a partir de uma conversa
- **Quando** o lead é inserido
- **Então** `comercial.leads.contato_id` aponta para o mesmo contato da conversa

### AC-4: Timeline agrega conversa, mensagens e lead
- **Dado** um contato com conversa/mensagens/lead
- **Quando** chama `relacionamento.get_timeline_contato(contato_id)`
- **Então** recebe eventos ordenados de atendimento e comercial

### AC-5: RLS protege a base transversal
- **Dado** usuário sem `pcm`, `atendimento` nem `comercial`
- **Quando** tenta ler `relacionamento.contatos`
- **Então** não vê linhas protegidas

## Fora de escopo
- UI dedicada de CRM.
- Deduplicação retroativa de `pcm.clientes.contato_*`.
