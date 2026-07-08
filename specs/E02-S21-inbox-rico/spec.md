---
name: spec
description: Contrato — inbox rico (áudio, templates, mídia, interativo, tags na conversa), paridade heziomos.
alwaysApply: true
---

# Spec — Inbox rico (paridade de composição)

> **Fonte da verdade.** Status: implementado localmente; pgTAP/UAT Evolution pendentes · Tier: Médio
> Hoje o inbox só envia texto (`ConversaChat` + `MensagemBubble`). O heziomos tem composição rica.

## Resumo
O inbox de Atendimento passa a suportar envio de áudio, mídia (imagem/arquivo), mensagens por template
de WhatsApp, mensagens interativas (botões/listas), tags na conversa e badge de canal — em paridade com
o heziomos.

## Critérios de aceite

### AC-1: Áudio e mídia
- **Dado** uma conversa aberta
- **Quando** o atendente grava áudio ou anexa imagem/arquivo e envia
- **Então** a mídia é enviada pelo canal, aparece na timeline e é reproduzível/visível (preview)

### AC-2: Templates de WhatsApp
- **Dado** templates aprovados (E02-S16)
- **Quando** o atendente compõe por template e envia
- **Então** a mensagem sai no formato do template com os placeholders preenchidos

### AC-3: Mensagens interativas
- **Dado** o compositor interativo
- **Quando** o atendente envia botões/lista
- **Então** o cliente recebe a mensagem interativa e a resposta é registrada na conversa

### AC-4: Tags na conversa e badge de canal
- **Dado** uma conversa
- **Quando** exibida
- **Então** mostra o badge do canal (WhatsApp/Instagram/Messenger) e permite aplicar/remover tags na própria conversa

## Casos de borda e erros
- Canal que não suporta um tipo (ex.: template só WhatsApp) → opção desabilitada com motivo.
- Upload de mídia falha → erro claro, mensagem não some do compositor.
- Áudio sem permissão de microfone → aviso, degrada para anexo.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Conexão dos canais — `E02-S16`/`E02-S19`. Fluxos — `E02-S20`.

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `AudioRecorder`, `TemplateComposer`, `InteractiveComposer`, `MediaAttachButton/Preview`,
  `ConversationTags`, `ChannelBadge`.
- Âncora Sinergica: `components/ConversaChat.tsx`, `components/MensagemBubble.tsx`, `domain/mensagens.ts`.
