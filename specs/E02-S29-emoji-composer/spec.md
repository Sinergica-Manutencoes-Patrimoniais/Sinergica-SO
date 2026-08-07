---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Emoji no composer do Inbox

> **Fonte da verdade.** Status: aprovado (Lucas, 2026-08-07)

## Resumo
O composer de texto do Inbox de Atendimento (`ConversaChat.tsx`) ganha um botão de emoji que
insere o caractere na posição do cursor, sem sair do teclado pra abrir o emoji nativo do SO.

## Critérios de aceite

### AC-1: Botão de emoji abre um seletor com conjunto curado
- **Dado** o composer de texto do Inbox
- **Quando** o usuário clica no botão de emoji
- **Então** abre um painel com emoji agrupados por categoria relevante a atendimento (reações,
  positivo, negativo, saudação/despedida) — não o unicode inteiro, que é ruído pra um chat de
  suporte
- **E** o painel fecha ao selecionar um emoji, ao clicar fora, ou com `Escape`

### AC-2: Emoji insere na posição do cursor, não sempre no fim
- **Dado** o campo de texto com o cursor no meio de uma frase já digitada
- **Quando** o usuário seleciona um emoji
- **Então** o emoji é inserido exatamente na posição do cursor
- **E** o foco volta pro campo de texto com o cursor logo depois do emoji inserido (permite
  encadear vários emoji sem reabrir o painel)

### AC-3: Funciona também no composer rico
- **Dado** o campo de texto do `RichComposer` (mensagem interativa/legenda de mídia)
- **Quando** o usuário usa o seletor de emoji
- **Então** o mesmo componente funciona ali também — não duplica a lista de emoji

### AC-4: Acessível
- **Dado** o botão de emoji
- **Então** tem `aria-label="Inserir emoji"`
- **E** o painel é navegável por teclado (seta entre emoji, `Enter` seleciona)

## Casos de borda e erros
- Campo vazio → insere o emoji sozinho, sem espaço extra antes/depois.
- Emoji clicado repetidamente → cada clique insere de novo (usuário decide quando parar), painel
  não fecha automaticamente a cada seleção (permite emoji múltiplos em sequência — só fecha em
  clique fora/Escape/blur).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Busca por nome de emoji (":smile:" etc.) — conjunto curado é pequeno o suficiente pra não
  precisar.
- Emoji recentes/frequentes persistidos por usuário.
- Skin tone selector.
- Autocompletar emoji digitando `:` no teclado.

## Rastreabilidade
- Depende de: `packages/ui` `Popover` (novo, `@radix-ui/react-popover` já é dependência não usada
  desde E00-S15/ADR-0017)
