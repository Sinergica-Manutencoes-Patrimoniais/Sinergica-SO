---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Materiais, profundidade e chrome

> **Fonte da verdade.** Status: rascunho
> Depende de **E00-S14** e **E00-S15**. Apple, *Materials & Depth*: translucidez é uma camada
> funcional flutuante que dá estrutura sem roubar o foco; o peso do material codifica hierarquia.

## Resumo
As sombras deixam de ser as default do Tailwind (pretas, genéricas) e passam a ser derivadas do
navy da marca; a navegação vira camada translúcida com o conteúdo passando por baixo.

## Contexto medido (2026-08-07)
| Medida | Valor |
|--------|-------|
| `shadow-xl` (default do Tailwind) | **55** |
| `shadow-2xl` | 3 |
| `shadow-lg` / `shadow-sm` | 2 / 3 |
| Sombras arbitrárias distintas | 5 |
| **Total de variantes de sombra** | **9** |
| Uso de `backdrop-filter` | 1 (`backdrop-blur-[2px]` no scrim do modal) |

`shadow-xl` do Tailwind é preto puro com opacidade alta. Sobre o papel quente `#F4F2EC` da
marca, ele suja — lê como cinza morto, não como elevação. 55 modais usam exatamente essa sombra:
é o principal motivo de os modais parecerem "colados por cima" em vez de flutuando.

## Critérios de aceite

### AC-1: Escala de elevação de 4 degraus, derivada do navy
- **Dado** `index.css`
- **Quando** o design system é lido
- **Então** existem `--shadow-raised` (card), `--shadow-overlay` (dropdown/popover),
  `--shadow-modal` (diálogo), `--shadow-drawer` (painel lateral)
- **E** todos usam `rgba` derivado de `--color-navy` (`20, 28, 54`), nunca preto puro
- **E** cada degrau tem **duas camadas** (uma sombra de contato curta + uma difusa longa) —
  sombra de camada única lê como adesivo
- **E** os degraus têm override no tema escuro (sombra some no escuro; a separação passa a vir de
  borda e superfície mais clara)

### AC-2: Nenhuma sombra default do Tailwind sobrevive
- **Dado** `apps/web/src/**/*.tsx`
- **Quando** o gate estático roda
- **Então** a contagem de `shadow-(sm|md|lg|xl|2xl)` é **0**
- **E** a contagem de `shadow-\[...\]` arbitrário fora de `components/ui/` é **0**

### AC-3: Superfície maior lê como mais espessa
- **Dado** os 4 degraus
- **Quando** comparados
- **Então** o raio de desfoque e o deslocamento crescem monotonicamente de `raised` para
  `drawer` — um popover pequeno não pode ter a mesma sombra de um drawer de tela inteira

### AC-4: Chrome translúcido com conteúdo por baixo
- **Dado** o cabeçalho do módulo e a barra de ação da tela
- **Quando** o conteúdo rola
- **Então** o chrome é uma camada translúcida (`backdrop-filter: blur()` + fundo semi-opaco) e o
  conteúdo passa **por baixo** dela
- **E** não existe nenhuma camada translúcida clara empilhada sobre outra translúcida clara
  (a legibilidade colapsa)
- **E** `prefers-reduced-transparency: reduce` torna o chrome opaco e remove o desfoque

### AC-5: Borda de rolagem em vez de divisor rígido
- **Dado** um cabeçalho fixo sobre conteúdo rolável
- **Quando** o conteúdo passa por baixo
- **Então** a separação é um desvanecimento sutil que **só aparece quando há conteúdo rolado
  por baixo** — não uma borda de 1px permanente
- **E** com o scroll no topo, nenhuma linha é desenhada

### AC-6: Camada modal escurece; camada paralela não
- **Dado** um modal bloqueante (formulário, confirmação)
- **Então** ele vem com scrim escuro e a camada de trás é empurrada levemente para trás
- **E** um painel **não bloqueante** (detalhe lateral, perfil do contato no inbox) usa
  translucidez e deslocamento **sem scrim** — escurecer o fundo de um painel paralelo quebra o
  fluxo de trabalho
- **E** modal sobre modal escurece progressivamente, sem somar dois scrims na mesma opacidade

### AC-7: Texto sobre material translúcido continua legível
- **Dado** texto sobre chrome translúcido
- **Então** ele usa peso e contraste elevados (nunca `--color-ink-3` cinza chapado) e um leve
  acréscimo de tracking
- **E** cor de marca (laranja) só é aplicada em camada sólida, nunca sobre o material translúcido

## Casos de borda e erros
- Navegador sem `backdrop-filter` → degradar para fundo sólido, nunca para semi-transparente sem
  desfoque (texto sobre conteúdo cru é ilegível).
- Custo de `backdrop-filter` em lista longa → aplicar **só** no chrome fixo, nunca por linha.
- Tema escuro → sombra praticamente desaparece; a hierarquia precisa vir de `--color-line` e da
  superfície, senão tudo achata.
- Impressão/PDF → sombras e desfoque removidos no `@media print`.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- "Liquid glass" / vidro pesado como estética — a marca é industrial (navy + laranja +
  papel quente), não translúcida. Translucidez aqui é **funcional**, restrita ao chrome.
- Modo de alto contraste — é E00-S22.
- Redesenho de layout ou de grid.

## Rastreabilidade
- Depende de: **E00-S14**, **E00-S15**
- Relacionado: E00-S19 (materializar ≠ só desvanecer), E00-S22 (`prefers-contrast`)
