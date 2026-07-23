---
name: spec-E01-S89-atendimento-historico-chamado
description: Contrato — no atendimento WhatsApp, anexar histórico de X dias da conversa a um Chamado, deixando o registro salvo.
alwaysApply: true
tier: pequeno
---

# Spec — Anexar histórico de WhatsApp a um Chamado

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16), item 3.2. "Nas conversas de WhatsApp no atendimento,
> terá opção de enviar histórico de X dias para aquele chamado, para ficar o registro da conversa
> salvo." Objetivo do Fabrício: evitar abrir o WhatsApp pra buscar histórico.

## Resumo
Na conversa de atendimento (WhatsApp), o operador pode **enviar o histórico dos últimos X dias** para
um **Chamado** (E01-S88), deixando o registro da conversa salvo e rastreável junto do Chamado.

## Contexto atual (AS-IS)
- Atendimento/inbox: `apps/web/src/features/atendimento/pages/AtendimentoInboxPage.tsx`; canal
  WhatsApp via Evolution (`supabase/functions/atendimento-evolution/`). Módulo E02.
- Chamado: `pcm.chamados` (E01-S88).

## Critérios de aceite

### AC-1: Ação "enviar histórico para Chamado"
- **Dado** uma conversa de WhatsApp aberta no inbox
- **Quando** o operador escolhe "enviar histórico para o Chamado" e informa a janela (X dias) e o
  Chamado alvo
- **Então** as mensagens daquela janela são copiadas/vinculadas ao Chamado como registro salvo
  (texto + referência de anexos de mídia), visíveis no detalhe do Chamado.

### AC-2: Seleção do Chamado
- **Dado** a ação de anexar histórico
- **Quando** o operador precisa escolher o Chamado
- **Então** pode selecionar um Chamado existente (do mesmo cliente/contato) ou criar um novo na hora
  (reusa criação de E01-S88).

### AC-3: Registro imutável do snapshot
- **Dado** um histórico já anexado
- **Quando** a conversa continua depois
- **Então** o snapshot anexado reflete a janela escolhida no momento do anexo (não muda
  retroativamente); anexar de novo cria outro registro.

## Casos de borda e erros
- Janela sem mensagens → avisa, não cria registro vazio.
- Mídia (foto/áudio) → guardar referência/URL, não necessariamente reprocessar o binário.
- Cross-módulo (Atendimento E02 → PCM Chamado): respeitar fronteira de features (compartilhar via
  contrato/`packages`, não import direto entre domínios — ver `CLAUDE.md` §arquitetura).

## Fora de escopo (vinculante)
- Sincronização contínua/automática da conversa (é ação sob demanda).
- Análise de IA do histórico.

## Rastreabilidade
- `apps/web/src/features/atendimento/pages/AtendimentoInboxPage.tsx`
- `supabase/functions/atendimento-evolution/` (fonte das mensagens)
- Chamado: `pcm.chamados` (E01-S88) + contrato de vínculo histórico↔Chamado
- Fronteira Atendimento↔PCM: contrato compartilhado
