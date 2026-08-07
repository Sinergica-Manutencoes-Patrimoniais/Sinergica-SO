---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Tokens semânticos e erradicação de cor hardcoded

> **Fonte da verdade.** Status: rascunho
> Fundação do redesign visual. **Bloqueia E00-S15..S22** — nenhuma primitiva, dark mode ou
> material pode ser construído sobre 812 cores cruas espalhadas em 102 arquivos.

## Resumo
A cor deixa de ser escrita em hex dentro do JSX e passa a vir exclusivamente de tokens
semânticos (`success`/`warning`/`danger`/`info` + escalas de superfície), que respondem ao
tema claro/escuro sem nenhum `dark:` por chamada.

## Contexto medido (2026-08-07)
| Medida | Valor |
|--------|-------|
| Classes com hex cru (`bg-[#...]`, `text-[#...]`, `border-[#...]`) | 812 |
| Arquivos `.tsx` afetados | 102 de 139 |
| Arquivos que usam `dark:` | 6 de 139 |
| `bg-white` literal (ignora `--color-card`) | 49 |
| Consumidores de `useTheme` | 2 (`theme-context.tsx`, `HomePage.tsx`) |

Os hex mais repetidos são o par de status **erro** (`#A23B25` texto / `#FFF4F1` fundo /
`#F2C0B5` borda — 142/80/76 usos) e **sucesso** (`#1E8E45` / `#E7F6EC` — 61/24). Ou seja: já
existe um sistema semântico de fato, só nunca foi nomeado.

## Critérios de aceite

### AC-1: Tokens semânticos de status existem e flipam com o tema
- **Dado** `apps/web/src/index.css`
- **Quando** o design system é lido
- **Então** existem, no bloco `@theme`, os tokens `--color-success`, `--color-success-soft`,
  `--color-success-line`, `--color-warning`, `--color-warning-soft`, `--color-warning-line`,
  `--color-danger`, `--color-danger-soft`, `--color-danger-line`, `--color-info`,
  `--color-info-soft`, `--color-info-line`
- **E** cada um dos 12 tem override correspondente dentro de `html[data-theme="dark"]`
- **E** os valores de tema claro reproduzem exatamente os hex hoje dominantes (`#1E8E45`,
  `#E7F6EC`, `#A23B25`, `#FFF4F1`, `#F2C0B5`) — a troca é de nome, não de aparência

### AC-2: Nenhum hex cru sobrevive em classe utilitária de JSX
- **Dado** qualquer arquivo em `apps/web/src/**/*.tsx`
- **Quando** o gate de contrato de token roda
- **Então** a contagem de ocorrências do padrão `(bg|text|border|ring|from|to|via)-\[#[0-9A-Fa-f]{3,8}\]`
  é **0**
- **E** a contagem de `bg-white` / `text-black` literais é **0** (substituídos por `bg-card` /
  `text-ink`)

### AC-3: A cor de status vira função de domínio, não string no componente
- **Dado** que hoje `prioridadeColor(...)` e `statusOsColor(...)` retornam strings de classe com
  hex embutido
- **Quando** essas funções são chamadas
- **Então** elas retornam apenas nomes de token (`"bg-danger-soft text-danger border-danger-line"`)
- **E** existe teste unitário que prova que nenhuma dessas funções retorna `#`

### AC-4: Dark mode não regride visualmente em nenhuma tela
- **Dado** o app com `data-theme="dark"`
- **Quando** um teste Playwright percorre as telas cobertas pelo smoke atual
- **Então** nenhum elemento tem `background-color` computado com luminância > 0.8 sobre o
  `--color-paper` escuro (proxy detectável de "patch claro esquecido")

### AC-5: O contraste passa no mínimo legal
- **Dado** cada par token-texto / token-fundo declarado (`ink` sobre `card`, `success` sobre
  `success-soft`, etc.) nos dois temas
- **Quando** o teste de contraste roda
- **Então** todo par atinge ≥ 4.5:1 (WCAG AA texto normal)
- **E** os pares usados só em texto ≥ 18px atingem ≥ 3:1

## Matriz de decisão — mapeamento hex → token

| Hex hoje | Usos | Token novo | Papel |
|----------|------|------------|-------|
| `#A23B25` / `#A12D24` / `#C5362B` | 142/68/16 | `--color-danger` | texto de erro |
| `#FFF4F1` / `#FFF4F2` / `#FDECEB` | 80/49/4 | `--color-danger-soft` | fundo de erro |
| `#F2C0B5` / `#F0C2BD` | 76/45 | `--color-danger-line` | borda de erro |
| `#1E8E45` / `#267343` | 61/12 | `--color-success` | texto de sucesso |
| `#E7F6EC` / `#EAF8EF` | 24/8 | `--color-success-soft` | fundo de sucesso |
| `#B26A00` / `#7A3F00` / `#9A6B00` / `#7A4D00` | 13/8/5/6 | `--color-warning` | texto de alerta |
| `#FDF1DF` / `#FFF8E8` | 7/5 | `--color-warning-soft` | fundo de alerta |
| `#F0D4B0` / `#F4D28C` | 10/5 | `--color-warning-line` | borda de alerta |
| `#EFF1F4` / `#EAEEF8` / `#EEF2FF` | 19/6/5 | `--color-info-soft` | fundo neutro/info |
| `#5A6175` / `#A8B0CC` | 19/18 | `--color-ink-2` / `--color-ink-3` | texto já existente |
| `bg-white` | 49 | `bg-card` | superfície |

> Toda linha desta tabela é um caso de teste do gate de AC-2.

## Casos de borda e erros
- Hex dentro de string de **geração de PDF** (`pdf-lib` usa `rgb()`, não CSS) → **fora** do gate;
  o `IGNORE` do checker deve excluir `src/lib/pdf/**`.
- Hex em `<svg fill="...">` de logo/ilustração → excluído do gate (ativo de marca, não token).
- Hex em teste que **asserta** a ausência de hex → auto-referência; o checker ignora
  `**/*.test.ts(x)`.
- Cor de gráfico (Recharts/Chart) precisa de valor resolvido, não de classe → expor via
  `getComputedStyle(document.documentElement).getPropertyValue('--color-...')` em helper
  `tokenCor(nome)`, nunca hex literal.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Redesenhar componente, layout, espaçamento ou tipografia — S14 é **troca de nome de cor**,
  aparência do tema claro fica pixel-idêntica.
- Criar primitivas de componente (`Badge`, `Card`) — é E00-S15.
- Adicionar `dark:` por chamada — a resposta ao tema é via token, não via variante.
- Mudar a paleta de marca (navy/orange/paper) — já validada com o cliente.

## Rastreabilidade
- Depende de: — (fundação)
- Bloqueia: E00-S15, E00-S16, E00-S17, E00-S20, E00-S22
- Contrato visual anterior: `apps/web/src/app/visual-v1.test.ts` (E01-S60)
