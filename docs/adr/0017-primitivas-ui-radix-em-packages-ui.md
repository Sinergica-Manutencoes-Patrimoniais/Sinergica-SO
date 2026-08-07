---
name: adr-0017-primitivas-ui-radix-em-packages-ui
description: Primitivas de UI vivem em packages/ui e usam Radix headless nas de sobreposição (dialog, popover, tooltip). Decide o home e a dependência da E00-S15.
alwaysApply: false
---

# ADR-0017 — Primitivas de UI em `packages/ui`, com Radix nas de sobreposição

> **ADRs são imutáveis.** Não edite este ADR; se mudar de ideia, crie um novo que o substitua.

**Status:** Aceito
**Data:** 2026-08-07
**Decisores:** Lucas (delegou a decisão), sessão Claude
**Relacionados:** E00-S15, E00-S16, E00-S22, E09-S11, ADR-0018

## Contexto

A auditoria visual de 2026-08-07 mediu, em `apps/web/src` (139 arquivos `.tsx`):

- `src/components/ui/` tem **1** componente (`Tooltip.tsx`)
- **28** páginas montam modal à mão a partir da classe `.modal-backdrop`
- **13** páginas montam `<table>` à mão
- **4** atributos `role` em todo o app; **1** `aria-live`; **1** `aria-labelledby`
- 8 raios de borda distintos, ~12 dialetos de badge

Duas restrições apareceram durante a decisão e mudaram a resposta:

**1. `packages/ui` já existe e já é dependência dos dois apps.** O conteúdo é um placeholder:

```ts
// @sinergica/ui — componentes base (shadcn/ui) compartilhados entre features.
// Placeholder inicial — preenchido na fase de construção.
export const UI_PACKAGE = "@sinergica/ui";
```

`apps/web/package.json` e `apps/portal/package.json` já declaram `"@sinergica/ui": "workspace:*"`.
A intenção arquitetural — pacote compartilhado, base shadcn/ui — foi registrada na fundação e
nunca construída. A E00-S15 tinha sido escrita colocando as primitivas em
`apps/web/src/components/ui/`, onde o portal (E09-S11, build/bundle separado) não as alcançaria,
e seriam construídas duas vezes.

**2. A E00-S22 tem AC de `axe-core` sem violação `critical`/`serious` nos dois temas.** Foco preso
em diálogo, restauração de foco ao fechar, `aria-modal`, travamento de scroll do `body` e
posicionamento com colisão de popover são exatamente o que falha esse gate quando feito à mão —
e são ~200 linhas por primitiva que costumam ficar sutilmente erradas.

## Decisão

**1. Toda primitiva de UI mora em `packages/ui`**, não em `apps/web/src/components/ui/`.
`apps/web` e `apps/portal` consomem por `@sinergica/ui`. `Tooltip.tsx` migra para lá.

**2. Primitivas de sobreposição usam Radix headless**, na forma do padrão shadcn/ui — o código do
componente é **nosso**, copiado para `packages/ui`, e só o comportamento vem da biblioteca:

| Primitiva | Base |
|-----------|------|
| `Modal` / `ConfirmDialog` | `@radix-ui/react-dialog` |
| `Popover` / menu | `@radix-ui/react-popover` |
| `Tooltip` | `@radix-ui/react-tooltip` |
| `Select` (quando o nativo não servir) | `@radix-ui/react-select` |

**3. Primitivas sem comportamento de sobreposição não levam dependência.** `Button`, `Badge`,
`Card`, `Field`, `DataTable`, `EmptyState`, `Skeleton` e `Toast` são escritos do zero. Radix não
entra "por padrão" — entra onde há foco, portal ou posicionamento a gerenciar.

**4. Estilo é 100% nosso, via tokens de E00-S14.** Nenhum tema, nenhum CSS, nenhum token de cor
da shadcn/ui é importado. A paleta navy/laranja/papel continua sendo a fonte.

**5. Não instalamos `shadcn` como dependência de runtime.** shadcn/ui é padrão de cópia, não
pacote. O que vai para o `package.json` são os pacotes `@radix-ui/react-*` individuais.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| **A (escolhida)** — `packages/ui` + Radix só nas de sobreposição | Acessibilidade correta onde é difícil; código e estilo nossos; serve web e portal; honra a intenção já registrada em `packages/ui` | 4 dependências novas; superfície de versão a acompanhar | De-risca diretamente o gate `axe` da E00-S22 e evita construir tudo duas vezes |
| B — tudo à mão, zero dependência | Nenhuma dependência nova | ~200 linhas por primitiva de sobreposição, com a parte de acessibilidade sendo a mais fácil de errar em silêncio; provável falha no gate de E00-S22 | O custo real não é o bundle, é a a11y que ninguém testa até quebrar |
| C — adotar a suíte shadcn/ui inteira de uma vez | Rápido, muitos componentes | Traz opinião visual e tokens que conflitam com a paleta de marca; componentes que não usaríamos | Importaria estética que a marca já resolveu |
| D — outra biblioteca completa (MUI, Mantine, Chakra) | Muita coisa pronta | Sistema de tema próprio brigando com os tokens de E00-S14; bundle grande; aparência reconhecível de terceiro — exatamente o que a story quer evitar | Contradiz o objetivo da story |

## Consequências

**Positivas:**
- `packages/ui` deixa de ser placeholder e passa a ser o que o scaffold prometeu.
- Portal (E09-S11) herda as primitivas sem duplicar código, e sem que o gate anti-vazamento de
  bundle seja afetado — `packages/ui` não contém rota nem regra de negócio.
- Foco, portal e colisão saem do nosso escopo de manutenção.
- O gate `axe` de E00-S22 fica atingível.

**Negativas / trade-offs aceitos:**
- 4 dependências novas (`react-dialog`, `react-popover`, `react-tooltip`, `react-select`),
  ~10–25KB gzip somadas, carregadas sob demanda depois do code splitting de E00-S21.
- Atualização de major do Radix vira trabalho de manutenção periódico.
- `packages/ui` precisa de build/tipos próprios no workspace — custo de configuração único.
- Risco de virar depósito: **só entra em `packages/ui` o que não tem regra de negócio nem
  conhecimento de domínio.** Componente que sabe o que é uma OS fica na feature.
