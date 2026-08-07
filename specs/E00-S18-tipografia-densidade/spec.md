---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Escala tipográfica, tracking e densidade

> **Fonte da verdade.** Status: rascunho
> Apple, *The Details of UI Typography* (WWDC 2020): tracking é específico do tamanho; leading
> varia inversamente ao tamanho; hierarquia se constrói com peso + tamanho + entrelinha juntos.

## Resumo
O produto ganha uma escala tipográfica nomeada, com tracking e entrelinha corretos por degrau,
e para de usar corpo de texto abaixo do legível para caber mais dado na tela.

## Contexto medido (2026-08-07)
| Classe | Usos | Tamanho |
|--------|------|---------|
| `text-sm` | 1157 | 14px |
| `text-xs` | 777 | 12px |
| `text-[11px]` | 151 | 11px |
| `text-base` | 119 | 16px |
| `text-lg` | 102 | 18px |
| `text-[10px]` | 80 | 10px |
| `text-xl` | 19 | 20px |
| `text-2xl` | 5 | 24px |
| `text-3xl` | 4 | 30px |
| `text-[9px]` | 1 | 9px |

**1009 usos de texto ≤ 12px.** O maior título do produto inteiro é 30px, usado 4 vezes — não há
hierarquia, há um platô de cinza pequeno. Tracking é fixo (`tracking-[-0.01em]` só em
`.page-title`); leading quase nunca é declarado. Tudo em `px`, então aumentar o tamanho de fonte
do sistema não faz nada.

## Critérios de aceite

### AC-1: Escala nomeada de 7 degraus, em `rem`
- **Dado** `index.css`
- **Quando** o design system é lido
- **Então** existem os degraus `--text-display`, `--text-title`, `--text-heading`,
  `--text-body`, `--text-body-sm`, `--text-caption`, `--text-micro`
- **E** cada degrau declara **tamanho + entrelinha + tracking juntos**, em `rem`
- **E** o menor degrau (`--text-micro`) não é inferior a **11px** equivalente

### AC-2: Tracking varia com o tamanho
- **Dado** os degraus da escala
- **Quando** os valores são inspecionados
- **Então** `display` e `title` têm tracking **negativo** (letras se afastam demais ao crescer)
- **E** `caption` e `micro` têm tracking **positivo** (legibilidade em corpo pequeno)
- **E** `body` fica em torno de `0`
- **E** não existe um único `letter-spacing` aplicado a todos os tamanhos

### AC-3: Entrelinha inversa ao tamanho
- **Dado** os degraus
- **Então** `display`/`title` têm `line-height` ≤ 1.15 e `body` ≥ 1.5

### AC-4: Fim do corpo abaixo de 11px
- **Dado** `apps/web/src/**/*.tsx`
- **Quando** o gate estático roda
- **Então** a contagem de `text-[9px]` e `text-[10px]` é **0**
- **E** a contagem de `text-\[[0-9]+px\]` arbitrário é **0** (só degraus nomeados)

### AC-5: Hierarquia real em cada tela
- **Dado** qualquer página
- **Quando** ela é renderizada
- **Então** existe exatamente **um** elemento no degrau mais alto da página (o título), e ele
  é `<h1>`
- **E** a ordem dos headings (`h1`→`h2`→`h3`) não pula degrau
- **E** `.page-title` sobe de `text-base` (16px) para `--text-title` — hoje o título da página
  tem o mesmo tamanho do corpo, o que apaga a hierarquia

### AC-6: Número é sempre tabular e alinhado
- **Dado** qualquer valor numérico em tabela, KPI ou coluna monetária
- **Então** usa `font-brand` (Saira) com `tabular-nums` e alinhamento à direita
- **E** valor monetário e percentual nunca "dançam" ao atualizar

### AC-7: A tela respeita o tamanho de fonte do usuário
- **Dado** o navegador com tamanho de fonte em 125%
- **Quando** qualquer tela é aberta
- **Então** o texto cresce proporcionalmente e o layout acompanha
- **E** nenhum container corta texto (`overflow` escondido) ou gera scroll horizontal no `body`

## Casos de borda e erros
- Nome de cliente muito longo em coluna estreita → truncar com `…` **e** `title` com o texto
  completo; nunca quebrar o layout da linha.
- Rótulo de badge em caixa-alta → tracking positivo obrigatório (caixa-alta sem tracking cola).
- Idioma: acentuação PT-BR precisa de espaço para ascendentes/descendentes — não apertar
  `line-height` abaixo de 1.15 em nenhum degrau.
- Impressão / PDF gerado no navegador → escala em `rem` não pode quebrar o layout de impressão.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Trocar as fontes (Poppins corpo / Saira numerais ficam — são da marca).
- Reduzir densidade de informação por decisão de produto (quantas colunas a tabela mostra).
- Internacionalização.

## Rastreabilidade
- Depende de: **E00-S15** (as primitivas passam a consumir os degraus)
- Relacionado: E00-S22 (acessibilidade — AC-5 e AC-7 são também requisitos de a11y)
