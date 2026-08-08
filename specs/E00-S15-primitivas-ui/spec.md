---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Biblioteca de primitivas UI

> **Fonte da verdade.** Status: rascunho
> Depende de **E00-S14** (tokens). Decisões de home e dependência fechadas em **ADR-0017**.
> É o que elimina a sensação de "cada tela foi feita separadamente" — hoje ela foi, literalmente.

## Resumo
`packages/ui` deixa de ser um placeholder vazio e passa a ser a única fonte de botão, badge,
card, campo, tabela, modal e estado vazio — e as 56 telas param de reinventar cada um.

## Contexto medido (2026-08-07)
| Medida | Valor |
|--------|-------|
| Conteúdo de `packages/ui/src/index.ts` | **placeholder** (`export const UI_PACKAGE`) |
| Componentes em `apps/web/src/components/ui/` | **1** (`Tooltip.tsx`) |
| Páginas que montam modal à mão (`modal-backdrop` inline) | 28 |
| Páginas que montam `<table>` à mão | 13 |
| Raios de borda distintos em uso | 8 (`2,3,4,5,6,7,8,10px`) |
| `rounded-[6px]` / `rounded-[8px]` escritos à mão | 503 / 250 |
| Variantes de sombra distintas | 9 |
| Formas distintas de badge/pill | ~12 |
| Uso de `.surface-card` / `.page-header` / `.empty-state` | 10 / 4 / 2 |
| Formulários com `onSubmit` / com `onBlur` | **12 / 1** |
| Arquivos com `required` / com erro por campo | **1 / 0** |
| Arquivos com `setErro` (uma string de erro por página inteira) | **77** |

Dois fatos decidem o desenho desta story:

**`packages/ui` já existe e ambos os apps já dependem dele.** O arquivo diz literalmente
"componentes base (shadcn/ui) compartilhados entre features — placeholder inicial". A intenção
foi registrada na fundação e nunca construída. Primitiva em `apps/web/src/components/ui/` não
alcança o portal (E09-S11, bundle separado) e seria construída duas vezes.

**O design system em `index.css` já tem** `.btn-primary`, `.surface-card`, `.empty-state` — e
quase ninguém importa (10, 4 e 2 arquivos). Classe utilitária não se impõe; componente e gate de
push se impõem.

## Critérios de aceite

### AC-1: Escala de raio fechada em 4 degraus
- **Dado** o design system
- **Quando** ele é lido
- **Então** existem exatamente os tokens `--radius-sm` (4px), `--radius-md` (6px),
  `--radius-lg` (10px), `--radius-xl` (14px) e `--radius-full`
- **E** a contagem de `rounded-\[[0-9]+px\]` em `apps/**/src/**/*.tsx` é **0**

### AC-2: As primitivas moram em `packages/ui` e servem os dois apps
- **Dado** `packages/ui`
- **Quando** a story conclui
- **Então** ele exporta `Button`, `Badge`, `Card`, `Field`, `Input`, `Select`, `Textarea`,
  `DataTable`, `Modal`, `EmptyState`, `Tooltip`
- **E** `apps/web/src/components/ui/Tooltip.tsx` foi migrado e não existe mais
- **E** nenhuma primitiva conhece domínio — nada em `packages/ui` sabe o que é OS, cliente ou
  chamado (gate estático)
- **E** o gate anti-vazamento de bundle do portal (E09-S11) continua verde

### AC-3: `Button` é a única forma de botão
- **Dado** `packages/ui` → `Button`
- **Quando** um botão é renderizado
- **Então** ele aceita `variant` (`primary` | `accent` | `secondary` | `ghost` | `danger`),
  `size` (`sm` | `md`) e `icon`
- **E** tem estado `:active` com `scale(0.97)` e `loading` que desabilita + mostra spinner
  **sem trocar a largura do botão** (evita salto de layout)
- **E** nenhum `<button>` cru com `className` de estilo sobrevive fora de `packages/ui`
  (gate estático conta 0)

### AC-4: `Badge` unifica os ~12 dialetos de pill
- **Dado** `Badge`
- **Quando** um status é exibido
- **Então** o componente aceita `tone` (`neutral` | `success` | `warning` | `danger` | `info` |
  `accent`) e resolve fundo/texto/borda pelos tokens de E00-S14
- **E** `prioridadeColor`/`statusOsColor` passam a devolver `tone`, não classe

### AC-5: `DataTable` substitui as 13 tabelas manuais
- **Dado** `DataTable`
- **Quando** uma lista tabular é exibida
- **Então** o componente entrega, de graça e igual em toda tela: header `sticky`, scroll
  horizontal contido (`overflow-x` no wrapper, nunca no `body`), zebra opcional, alinhamento
  numérico `tabular-nums` à direita, estado vazio, estado de carregamento e ordenação por coluna
- **E** a contagem de `<table` fora de `packages/ui` é **0**

### AC-6: `Modal` substitui os 28 modais inline
- **Dado** `Modal`, construído sobre `@radix-ui/react-dialog` (ADR-0017)
- **Quando** um modal abre
- **Então** ele entrega: foco preso dentro do painel, `Escape` fecha, clique no scrim fecha,
  foco devolvido ao gatilho ao fechar, `role="dialog"` + `aria-modal="true"` +
  `aria-labelledby` apontando pro título, scroll do `body` travado
- **E** a contagem de `modal-backdrop` fora de `packages/ui` é **0**
- **E** o estilo do painel vem inteiramente dos nossos tokens — nenhum CSS ou token da shadcn/ui
  é importado

### AC-7: `Field` acaba com o label solto
- **Dado** `Field`
- **Quando** um campo de formulário é renderizado
- **Então** label, controle, texto de ajuda e mensagem de erro compartilham `id` /
  `aria-describedby` / `aria-invalid` gerados automaticamente
- **E** campo obrigatório é marcado visualmente **e** por `required`/`aria-required`

### AC-8: A validação acontece no campo, não só no envio
- **Dado** um formulário
- **Quando** o usuário sai de um campo (`blur`) com valor inválido
- **Então** o erro aparece **naquele campo**, imediatamente, sem esperar o envio
- **E** o erro do campo some assim que o valor volta a ser válido, ainda durante a digitação
- **E** o envio com erro move o foco para o **primeiro campo inválido** e o anuncia
- **E** a mensagem diz o que fazer ("informe um e-mail válido"), não o que falhou
  ("validação falhou")
- **E** a faixa de erro do topo da página fica reservada a falha de **operação** (rede,
  permissão, conflito) — nunca a erro de preenchimento

> Hoje há 12 formulários com `onSubmit`, **1** com `onBlur`, **0** com erro por campo e 77
> arquivos com `setErro` — uma única string de erro por página inteira. O usuário preenche 14
> campos, envia, e recebe uma faixa vermelha no topo sem saber qual campo está errado.

### AC-9: A validação reusa `zod`, sem dependência nova
- **Dado** que `zod` já é dependência do projeto
- **Quando** um formulário declara suas regras
- **Então** o schema `zod` é a **única** fonte da regra, compartilhada entre a validação de campo,
  a de envio e a do domínio
- **E** nenhuma biblioteca de formulário nova entra sem ADR

### AC-10: A biblioteca é auto-demonstrável
- **Dado** a rota interna `/ui` (só em dev, ou atrás de papel `superadmin`)
- **Quando** ela é aberta
- **Então** mostra todas as primitivas × todas as variantes × ambos os temas, lado a lado
- **E** serve de gate visual humano antes de qualquer PR de UI

## Casos de borda e erros
- Tabela com 0 colunas visíveis por permissão → `DataTable` renderiza estado vazio explicativo,
  não header órfão.
- Modal aberto sobre modal (confirmação dentro de formulário) → empilhamento por camada, scrim
  progressivamente mais escuro, `Escape` fecha só o topo.
- `Button loading` durante navegação → não pode ficar preso se a promise rejeitar (sempre
  `finally`).
- Campo que só pode ser validado no servidor (CNPJ duplicado) → erro de servidor precisa cair
  **no campo**, não na faixa do topo; `Field` aceita erro externo.
- Campo ainda não tocado → **não** mostrar erro antes do primeiro `blur`; validar na digitação
  desde o primeiro caractere pune quem está escrevendo.
- `DataTable` com 5000 linhas → **fora de escopo** virtualizar nesta story; documentar limite e
  paginar.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Trocar biblioteca de ícones (`lucide-react` fica).
- Adotar a suíte shadcn/ui inteira, ou qualquer biblioteca de UI com tema próprio (MUI, Mantine,
  Chakra) — ADR-0017 já decidiu: só os pacotes `@radix-ui/react-*` das primitivas de sobreposição.
- Biblioteca de formulário (`react-hook-form`, `formik`) — `zod` + estado local resolvem o AC-8.
- Virtualização de tabela.
- Animação de entrada/saída — é E00-S19.

## Rastreabilidade
- Depende de: **E00-S14**
- Bloqueia: E00-S16, E00-S17, E00-S19, E00-S20, E00-S22
- Decisões: **ADR-0017** (home em `packages/ui` + Radix nas de sobreposição)
- Contrato visual anterior: `apps/web/src/app/visual-v1.test.ts` (E01-S60)
- Relacionado: E09-S11 (gate anti-vazamento de bundle do portal não pode regredir)
