---
name: spec-E02-S09-agente-comercial-whatsapp
description: Contrato do agente comercial ligado a uma instância Evolution dedicada.
alwaysApply: true
tier: arquitetural
---

# Spec — Agente comercial via WhatsApp

> **Fonte da verdade.** Status: aprovado.

## Critérios de aceite

### AC-1: Roteamento por instância
- **Dado** uma instância ativa vinculada a uma persona comercial ativa
- **Quando** chega uma mensagem nessa instância
- **Então** o runtime usa exatamente essa persona, sem cair no agente de chamados.

### AC-2: Configuração isolada
- **Dado** duas personas
- **Quando** o agente comercial processa a conversa
- **Então** usa seu próprio prompt, modelo, base/RAG, agenda, fluxo e regras de transferência.

### AC-3: Qualificação guiada
- **Dado** um fluxo ativo da persona
- **Quando** faltam campos obrigatórios
- **Então** o agente pergunta somente pelo que falta e não cria lead prematuramente.

### AC-4: Lead ligado ao contato
- **Dado** os dados obrigatórios completos
- **Quando** a qualificação termina
- **Então** cria `comercial.leads` com score/resumo e liga lead, conversa e contato único.

### AC-5: Resposta pela origem
- **Dado** uma pergunta ou confirmação do agente
- **Quando** responde
- **Então** envia pela mesma `instance_id` que recebeu a mensagem.

### AC-6: Handoff humano
- **Dado** palavra, quantidade ou limite configurado atingido
- **Quando** o runtime avalia a conversa
- **Então** pausa a IA, deixa a conversa pendente e registra o motivo.

### AC-7: Segurança e idempotência
- **Dado** payload forjado, `fromMe` ou mensagem reentregue
- **Quando** chega ao webhook
- **Então** autenticação, filtro e dedupe impedem processamento indevido ou duplicado.

## Fora de escopo
- Alterar entidades do funil comercial após a criação do lead.
- Usar uma única instância simultaneamente com duas personas ativas.

## Rastreabilidade
- Runtime: `supabase/functions/pcm-ze-agent/index.ts`
- Entrada: `supabase/functions/pcm-whatsapp-webhook/index.ts`
- Contrato multi-instância: `../E02-S22-atendimento-evolution-multiinstancia/`
