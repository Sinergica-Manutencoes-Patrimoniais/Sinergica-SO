---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Gesto do drawer móvel, interrompível

> **Fonte da verdade.** Status: rascunho
> Extraída do AC-7 original da **E00-S19** por decisão do **ADR-0018**. É a única superfície de
> gesto do produto e o único lugar onde uma biblioteca de mola pode se justificar.

## Resumo
O menu lateral no celular passa a seguir o dedo 1:1 e a decidir abrir ou fechar pela velocidade
da soltura, podendo ser agarrado e revertido a qualquer instante.

## Contexto

O `HomePage` tem um drawer lateral em viewport pequena (`-translate-x-full` / `lg:static`,
contratado em `visual-v1.test.ts` desde E01-S60). Hoje ele só abre e fecha por clique, com
transição fixa: não segue o dedo, não pode ser interrompido, e um toque acidental obriga a
esperar a animação inteira.

Levantamento da superfície de gesto do produto inteiro (2026-08-07): **um** componente — este.
Não há carrossel, bottom sheet, swipe entre telas nem arrastar-e-soltar. Por isso ADR-0018 tirou
o gesto da E00-S19 e o isolou aqui, com **orçamento explícito de implementação** — é a story que
decide se uma biblioteca de mola entra no projeto, e ela decide com o componente na mão.

## Critérios de aceite

### AC-1: O painel segue o dedo 1:1
- **Dado** o drawer aberto em viewport móvel
- **Quando** o usuário arrasta horizontalmente
- **Então** o painel acompanha o dedo na proporção 1:1, respeitando o **deslocamento do ponto em
  que foi agarrado** (não salta para centralizar no dedo)
- **E** o rastreamento continua mesmo se o dedo sair dos limites do painel
  (`setPointerCapture`)
- **E** a atualização é contínua durante todo o arrasto, não só na soltura

### AC-2: Abrir ou fechar é decidido pela velocidade, não pela posição
- **Dado** um arrasto em andamento
- **Quando** o usuário solta
- **Então** a decisão usa o **sinal da velocidade** na soltura: soltar movendo para fechar fecha,
  mesmo que o painel ainda esteja 80% aberto
- **E** com velocidade próxima de zero, a decisão cai para a posição (mais de meio caminho)
- **E** a animação final parte da **velocidade real do dedo**, sem emenda visível entre arrastar
  e animar

### AC-3: O gesto é interrompível e reversível a qualquer instante
- **Dado** o drawer em movimento (animando para abrir ou fechar)
- **Quando** o usuário o agarra de novo no meio do caminho
- **Então** ele passa a seguir o dedo a partir da **posição atual na tela**, sem salto
- **E** reverter o sentido não produz descontinuidade de velocidade ("parede")

### AC-4: Limite com resistência progressiva
- **Dado** o drawer totalmente aberto
- **Quando** o usuário continua arrastando no sentido de abrir mais
- **Então** a resistência cresce progressivamente (rubber-band) em vez de travar duro
- **E** ao soltar, o painel volta ao limite

### AC-5: Só o gesto certo é capturado
- **Dado** um arrasto começando dentro do drawer
- **Quando** o movimento é predominantemente **vertical**
- **Então** ele é tratado como rolagem do conteúdo, não como fechamento do drawer
- **E** o compromisso com a direção só ocorre após ~10px de movimento (histerese)
- **E** um toque sem arrasto continua funcionando como clique no item do menu

### AC-6: Movimento reduzido desliga o gesto, não a função
- **Dado** `prefers-reduced-motion: reduce`
- **Quando** o usuário abre ou fecha o drawer
- **Então** a transição vira cross-fade curto e o arrasto não anima elasticamente
- **E** abrir e fechar por **clique** continua funcionando normalmente em qualquer configuração

### AC-7: O orçamento de implementação decide a dependência
- **Dado** a implementação dos AC-1 a AC-6
- **Quando** ela estiver funcionando e testada
- **Então** se couber em **≤ 120 linhas** de Pointer Events + Web Animations API, **nenhuma
  biblioteca entra** e o ADR-0018 permanece válido
- **E** se passar de 120 linhas, a biblioteca entra **apenas para este componente**, carregada
  sob demanda, e um ADR novo substitui o ADR-0018 declarando o número medido
- **E** a contagem de linhas e a decisão ficam registradas no PR

## Casos de borda e erros
- Dispositivo com mouse e tela de toque simultâneos → Pointer Events cobre os dois; não
  ramificar por `ontouchstart`.
- Gesto iniciado e o usuário troca de aba no meio → `pointercancel` devolve o painel a um estado
  válido (aberto ou fechado), nunca parado no meio.
- Arrasto durante troca de rota (após E00-S21) → gesto cancelado, painel fecha.
- Viewport cruza o breakpoint `lg` durante o arrasto (rotação de tablet) → gesto cancelado e o
  menu volta ao modo estático, sem `transform` residual travando o layout.
- Leitor de tela / navegação por teclado → o drawer precisa continuar abrindo por `aria-label`
  "Abrir menu" e fechando por `Escape`; o gesto é adicional, nunca o único caminho.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Estender gesto a qualquer outro componente (tabela, modal, cards) — o produto não tem outra
  superfície de gesto e criar uma é decisão de produto, não desta story.
- Swipe-to-dismiss do toast — já entregue de forma simples na E00-S16; não reabrir aqui.
- Redesenhar o conteúdo ou a estrutura do menu.
- Trocar o contrato do drawer fixado em `visual-v1.test.ts` (E01-S60).

## Rastreabilidade
- Depende de: **E00-S19** (curvas, `reduced-motion`, interrupção por valor computado)
- Origem: AC-7 original da E00-S19, extraído por **ADR-0018**
- Pode substituir: **ADR-0018**, se o orçamento de 120 linhas estourar
- Contrato existente: `apps/web/src/app/visual-v1.test.ts` (drawer móvel, E01-S60)
