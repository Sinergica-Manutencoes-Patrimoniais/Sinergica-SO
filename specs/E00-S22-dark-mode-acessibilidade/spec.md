---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Tema escuro real e acessibilidade

> **Fonte da verdade.** Status: rascunho
> Depende de **E00-S14** (tokens) e **E00-S15** (primitivas). Fecha o lote visual.

## Resumo
O seletor de tema escuro deixa de ser decorativo e passa a funcionar em todas as telas, e o
sistema passa a ser operável por teclado e leitor de tela.

## Contexto medido (2026-08-07)
| Medida | Valor |
|--------|-------|
| Tokens com override em `html[data-theme="dark"]` | 14 (existem e estão corretos) |
| Arquivos `.tsx` que usam `dark:` | **6 de 139** |
| Arquivos com hex cru que **não** responde ao tema | **102** |
| Consumidores de `useTheme` | 2 |
| Atributos `role` em todo o app | **4** (`tooltip`, `switch`, `img`, `alert`) |
| `aria-live` | 1 |
| `aria-labelledby` | 1 |
| `aria-label` | 69 (quase todos em botão-ícone do menu) |
| `prefers-reduced-motion` | 0 |
| `prefers-contrast` | 0 |

O tema escuro está **implementado pela metade e entregue**: o seletor existe, os tokens flipam,
e 102 arquivos ignoram tudo. Hoje, ligar o tema escuro produz um resultado pior do que não ter a
opção.

## Critérios de aceite

### AC-1: O tema escuro funciona em todas as telas
- **Dado** o app com `data-theme="dark"`
- **Quando** um teste percorre as 56 telas
- **Então** nenhuma delas apresenta elemento com fundo claro isolado sobre superfície escura
- **E** nenhum texto fica com contraste < 4.5:1 contra o fundo efetivo
- **E** a captura de tela de cada tela nos dois temas é revisada uma vez (gate humano, registrado
  no PR)

### AC-2: A preferência do sistema é o padrão
- **Dado** um usuário que nunca escolheu tema
- **Quando** entra no sistema
- **Então** o tema segue `prefers-color-scheme` do sistema operacional
- **E** uma escolha explícita persiste entre sessões e vence a preferência do sistema
- **E** a troca de tema é suave, sem salto brusco de brilho

### AC-3: Todo fluxo é operável só pelo teclado
- **Dado** um usuário sem mouse
- **Quando** percorre login, abrir OS, filtrar lista, abrir e submeter modal, enviar mensagem
- **Então** consegue completar cada fluxo inteiro por teclado
- **E** o foco é sempre visível (o anel laranja de `:focus-visible` já existe — precisa não ser
  suprimido por nenhum componente)
- **E** a ordem de foco segue a ordem visual, sem armadilha

### AC-4: Semântica correta onde hoje há `div` clicável
- **Dado** os controles do sistema
- **Quando** o gate de acessibilidade roda
- **Então** não existe `div`/`span` com `onClick` sem `role` + `tabIndex` + handler de teclado
- **E** tabela usa `<th scope>`, aba usa `role="tab"`/`aria-selected`, alternador usa
  `role="switch"`/`aria-checked`, modal usa `role="dialog"`/`aria-modal`

### AC-5: Mudança dinâmica é anunciada
- **Dado** um leitor de tela
- **Quando** um toast aparece, uma lista termina de carregar, ou uma validação falha
- **Então** o anúncio ocorre por região `aria-live` apropriada (`polite` para status,
  `assertive` para erro)
- **E** erro de campo é ligado ao campo por `aria-describedby` + `aria-invalid`

### AC-6: `axe` limpo nas telas do smoke
- **Dado** as telas cobertas pelo smoke Playwright
- **Quando** `axe-core` roda em ambos os temas
- **Então** zero violação de severidade `critical` ou `serious`
- **E** o gate roda no CI, não só localmente

### AC-7: Alvos de toque adequados no celular
- **Dado** viewport móvel
- **Quando** qualquer controle acionável é medido
- **Então** a área de toque é ≥ 44×44px (mesmo que o ícone seja menor)
- **E** dois alvos adjacentes têm ≥ 8px de separação

### AC-8: `prefers-contrast: more` é respeitado
- **Dado** o sistema com contraste elevado
- **Então** superfícies ficam quase sólidas, com borda definida e contrastante
- **E** o texto terciário (`--color-ink-3`) sobe para o nível do secundário

## Casos de borda e erros
- Ativo de marca (logo positivo/negativo) → o logo correto precisa trocar com o tema; hoje
  `logo-horizontal-positivo.png` é fixo em `App.tsx` e some no escuro.
- Gráfico/Recharts → séries precisam ler cor via token resolvido (helper de E00-S14), senão
  ficam invisíveis no escuro.
- Imagem enviada pelo usuário (foto de inspeção, anexo) → **não** aplicar filtro de tema.
- Impressão sempre em tema claro, independente da escolha.
- Anel de foco laranja sobre fundo laranja (botão `accent` focado) → precisa de contorno externo
  contrastante, senão desaparece.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Tradução / internacionalização.
- Tema personalizado por usuário além de claro/escuro/sistema.
- Auditoria de acessibilidade do portal do cliente (`apps/portal`) — story própria.

## Rastreabilidade
- Depende de: **E00-S14**, **E00-S15**, **E00-S17**, **E00-S19** (movimento reduzido)
- Relacionado: E00-S20 (`prefers-reduced-transparency`), E00-S18 (AC-5/AC-7 de tipografia são
  também requisitos de a11y)
