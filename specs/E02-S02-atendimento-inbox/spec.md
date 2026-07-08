---
name: spec
description: Contrato — tela de Inbox de Conversas (lista + chat + perfil), toggle IA/humano, dentro do módulo Atendimento.
alwaysApply: true
---

# Spec — Inbox de Conversas

> **Fonte da verdade.** Status: aprovado · Tier: arquitetural
> Depende de: `E02-S01` (schema `atendimento.conversas`/`mensagens` + Zé integrado).

## Critérios de aceite

### AC-1: Lista de conversas ordenada e com preview
- **Dado** existem conversas em `atendimento.conversas`
- **Quando** o Inbox carrega
- **Então** a lista mostra as conversas ordenadas por `ultima_mensagem_em desc`, com preview da
  última mensagem e contagem de não lidas

### AC-2: Abrir conversa marca como lida e carrega histórico
- **Dado** uma conversa com `nao_lidas > 0`
- **Quando** o usuário seleciona a conversa na lista
- **Então** `nao_lidas` zera e o histórico completo de mensagens daquela conversa é exibido em
  ordem cronológica

### AC-3: Enviar mensagem grava e envia, erro não derruba a tela
- **Dado** um usuário com `podeAcessar('atendimento','escrita')` digita e envia uma mensagem
- **Quando** o envio ao Evolution falha
- **Então** a bolha da mensagem mostra estado de erro (`status_entrega='erro'`), sem quebrar o
  resto da tela nem impedir novas tentativas

### AC-4: Toggle IA/humano reflete no header do chat
- **Dado** uma conversa com `modo='auto'`
- **Quando** o usuário clica "Assumir"
- **Então** o header passa a mostrar "atribuído a você"/modo pausado, e uma nova mensagem do
  cliente naquela conversa não recebe resposta automática do Zé (AC-3 de `E02-S01`)

### AC-5: "Responder com IA agora" funciona fora do ciclo normal
- **Dado** uma conversa qualquer (mesmo fora da janela de debounce de 3s)
- **Quando** o usuário aciona "Responder com IA agora"
- **Então** o Zé processa a conversa imediatamente (via `forcar:true`)

### AC-6: Gate de permissão consistente com o resto do PCM
- **Dado** um usuário sem `atendimento` liberado
- **Quando** acessa o módulo Atendimento
- **Então** vê a tela de acesso restrito, mesmo padrão de `EquipesPage`/`TicketsPage`; com
  `leitura` mas sem `escrita`, vê tudo mas sem botões de ação (enviar/assumir/devolver/acionar IA)

## Casos de borda e erros
- Lista/mensagens vazias: estado vazio explícito (ícone + texto), não erro.
- Conversa sem `client_id` resolvido (cliente ainda não sincronizado): exibida normalmente na
  lista, perfil do contato mostra "cliente não vinculado" em vez de dados do PCM.
- Aba em background: polling pausado (`document.visibilitychange`), retoma ao focar.

## Fora de escopo
- Ver `product.md` → Non-goals.

## Rastreabilidade
- Design: `design.md` (este diretório).
- Depende de: `specs/E02-S01-atendimento-fundacao/spec.md`.
