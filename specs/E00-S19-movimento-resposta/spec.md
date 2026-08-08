---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Movimento, resposta e interrupção

> **Fonte da verdade.** Status: rascunho
> Depende de **E00-S15**. Dependência fechada em **ADR-0018**: CSS + Web Animations API, sem
> biblioteca de mola. Apple, *Designing Fluid Interfaces*: toda animação precisa ser
> interrompível e partir do valor **atual na tela**, nunca do valor lógico de destino.

## Resumo
A interface passa a responder ao toque no instante do toque e a animar apenas onde o movimento
explica alguma coisa — com curvas próprias, não com as fracas do CSS, e respeitando quem pediu
menos movimento.

## Contexto medido (2026-08-07)
| Medida | Valor |
|--------|-------|
| Arquivos com `transition-` | **12 de 139** |
| Arquivos com `animate-` | **5** |
| Arquivos com `prefers-reduced-motion` | **0** |
| Botões com `:active` | **0** |
| Biblioteca de mola/spring | inexistente |
| Curvas de easing customizadas | inexistente (só as default do CSS) |

Nada se move e nada responde ao toque. O produto parece uma folha de papel: correto e inerte.
O risco oposto — encher de animação — é pior, então esta story define **onde não animar** com o
mesmo rigor de onde animar.

## Critérios de aceite

### AC-1: Curvas próprias, não as default do CSS
- **Dado** `index.css`
- **Quando** o design system é lido
- **Então** existem `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`,
  `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` e
  `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`
- **E** a contagem de `transition-all` em `.tsx` é **0** (sempre a propriedade explícita)

### AC-2: Tabela de frequência decide o que anima
- **Dado** qualquer interação
- **Quando** a decisão de animar é tomada
- **Então** ela segue a matriz de decisão abaixo
- **E** ação disparada por teclado (atalho, `Enter` no formulário, navegação por `Tab`)
  **nunca** anima — é repetida dezenas de vezes por dia e a animação a faz parecer lenta

### AC-3: Resposta no `pointerdown`
- **Dado** qualquer controle acionável (`Button`, linha de tabela clicável, item de menu)
- **Quando** o usuário pressiona
- **Então** o feedback visual acontece no `pointerdown`, em ≤ 100ms, e é reversível
  arrastando para fora antes de soltar

### AC-4: Entrada e saída pelo mesmo caminho
- **Dado** um modal, drawer, toast ou popover
- **Quando** ele entra e depois sai
- **Então** o caminho de saída é o inverso do de entrada (o que desliza da direita sai pela
  direita), com a curva espelhada
- **E** popover/menu tem `transform-origin` no **gatilho que o abriu**, não no centro dele

### AC-5: Nada aparece do nada
- **Dado** qualquer elemento que entra em cena
- **Quando** ele anima
- **Então** parte de `opacity: 0` + `scale(0.96)` ou deslocamento pequeno — nunca de
  `scale(0)`, nem de opacidade sozinha em superfície grande

### AC-6: `prefers-reduced-motion` é respeitado em todo lugar
- **Dado** o sistema com movimento reduzido ativado
- **Quando** qualquer transição ocorre
- **Então** deslize, mola e paralaxe viram cross-fade curto (≤ 150ms)
- **E** o shimmer do skeleton (E00-S17) fica estático
- **E** o gate estático prova que **toda** regra de `transition`/`animation` do projeto está
  coberta por um bloco `@media (prefers-reduced-motion: reduce)`

### AC-7: Animação interrompida parte do valor que está na tela
- **Dado** um modal, drawer ou popover em pleno movimento
- **Quando** o usuário reverte a ação antes de a animação terminar (fecha enquanto abre)
- **Então** a nova animação parte do valor **computado no momento** (leitura de
  `getComputedStyle`/`getAnimations`), nunca do valor lógico de destino — sem salto visível
- **E** nenhuma animação bloqueia a entrada enquanto roda

> **Arrasto por gesto saiu daqui.** O arrasto 1:1 do drawer com herança de velocidade na soltura
> é a story **E00-S23** — é o único gesto real do produto e é onde a decisão de biblioteca de
> mola deve ser tomada, com o componente na mão (ADR-0018).

## Matriz de decisão — animar ou não

| Frequência de uso | Exemplo no Sinérgica SO | Decisão | AC |
|-------------------|--------------------------|---------|-----|
| Centenas/dia | atalho de teclado, `Enter` no formulário, `Tab` | **nunca animar** | AC-2 |
| Dezenas/dia | hover de linha, troca de aba do módulo, foco | transição de cor ≤ 120ms, sem movimento | AC-2 |
| Ocasional | abrir modal, drawer, toast, popover | animação padrão, `--ease-out`, 200–300ms | AC-2, AC-4, AC-5 |
| Gesto com inércia | arrastar drawer, swipe do toast | mola com velocidade herdada | **E00-S23** |
| Raro | primeiro login, conclusão de importação em lote | pode ter delicadeza extra | AC-2 |

## Casos de borda e erros
- Usuário fecha o modal enquanto ele ainda abre → precisa fechar da posição atual, sem esperar
  a abertura terminar (nada de fila de animação).
- Aba do navegador volta ao foco → **nenhuma** animação de re-entrada dispara (relacionado ao
  bug de revalidação de sessão corrigido em 2026-08-06).
- Máquina lenta / muitas linhas → animar só `transform` e `opacity`; jamais `height`,
  `top`/`left` ou `box-shadow` em lista.
- Teste automatizado → movimento precisa ser desligável por flag para o Playwright não ficar
  instável.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- **Qualquer biblioteca de animação** (`motion`, `framer-motion`, `react-spring`) — ADR-0018
  decidiu CSS + Web Animations API para esta story. A decisão de biblioteca é da E00-S23.
- Arrasto por gesto com herança de velocidade — é E00-S23.
- Animação decorativa de marketing, confete, celebração.
- Transição entre rotas — depende de E00-S21.

## Rastreabilidade
- Depende de: **E00-S15**, **E00-S17**
- Decisões: **ADR-0018** (CSS + WAAPI, sem biblioteca de mola)
- Continua em: **E00-S23** (gesto do drawer)
- Relacionado: E00-S21 (transição de rota), E00-S22 (movimento reduzido é a11y)
