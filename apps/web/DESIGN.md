---
name: Sinérgica SO
description: Sistema operacional de manutenção predial da Sinérgica — PCM decide, Auvo executa.
colors:
  navy-institucional: "#1c2748"
  navy-profundo: "#141c36"
  navy-linha: "#2e3a60"
  laranja-cirurgico: "#e8731b"
  laranja-pressionado: "#d2630f"
  laranja-suave: "#fbeee0"
  ambar: "#f4a300"
  papel: "#f4f2ec"
  superficie-card: "#ffffff"
  linha: "#e5e2d9"
  linha-suave: "#edeae2"
  tinta: "#1a2138"
  tinta-2: "#585e72"
  tinta-3: "#8c8f9b"
  tinta-4: "#b4b6be"
  tinta-nav: "#a8b0cc"
  sucesso: "#1a7a3b"
  sucesso-suave: "#e7f6ec"
  sucesso-linha: "#bfe9cc"
  alerta: "#9a5a00"
  alerta-suave: "#fdf1df"
  alerta-linha: "#f0d4b0"
  perigo: "#a23b25"
  perigo-suave: "#fff4f1"
  perigo-linha: "#f2c0b5"
  info: "#2e3c70"
  info-suave: "#eaeef8"
  info-linha: "#c7d0ec"
typography:
  display:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.006em"
  body:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  body-sm:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.002em"
  caption:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.01em"
  micro:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.02em"
  numero-tabular:
    fontFamily: "Saira, system-ui, sans-serif"
    fontSize: "inherit"
    fontWeight: 600
    lineHeight: "inherit"
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
components:
  button-primary:
    backgroundColor: "{colors.navy-institucional}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.navy-profundo}"
  button-accent:
    backgroundColor: "{colors.laranja-cirurgico}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-accent-hover:
    backgroundColor: "{colors.laranja-pressionado}"
  button-secondary:
    backgroundColor: "{colors.superficie-card}"
    textColor: "{colors.tinta-2}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "{colors.linha-suave}"
    textColor: "{colors.tinta}"
  input:
    backgroundColor: "{colors.superficie-card}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "6px 10px"
  card:
    backgroundColor: "{colors.superficie-card}"
    rounded: "{rounded.xl}"
  badge-neutral:
    backgroundColor: "{colors.linha-suave}"
    textColor: "{colors.tinta-2}"
    rounded: "9999px"
    padding: "2px 8px"
---

# Design System: Sinérgica SO

## Overview

**Creative North Star: "O Painel de Comando Técnico"**

Navy institucional é a estrutura de comando — sidebar, hierarquia, o que orienta. Laranja
cirúrgico é ação e prioridade — usado raro e sempre com intenção: CTA, indicador ativo,
criticidade. Papel quente (`#F4F2EC`) é a mesa de trabalho onde o operador resolve chamados e OS —
deliberadamente não é o slate genérico de dashboard SaaS (decisão registrada no próprio código-
fonte, `src/index.css`). O sistema serve quem decide e prioriza manutenção predial o dia inteiro:
supervisor e colaborador operando PCM — não visitante decidindo se compra algo.

A superfície é honesta e sem ornamento: hairlines quentes em vez de sombra pesada, tipografia
Poppins direta pro texto corrido, Saira reservada só pra número tabular (a "régua" numérica do
sistema — nunca dança de largura ao atualizar). O produto reconhece explicitamente sua própria
divisão de responsabilidade — PCM decide, Auvo executa — e essa disciplina se reflete na interface:
nada finge ter dado que só o Auvo tem autoridade sobre.

**Key Characteristics:**
- Estrutura navy, ação laranja rara, mesa de trabalho em papel quente — nunca slate genérico.
- Hairline > sombra pesada; sombra existe mas é sutil e desaparece no escuro em favor de borda.
- Número sempre em Saira + `tabular-nums`; texto corrido sempre em Poppins.
- Feedback instantâneo e contido — `active:scale-[0.97]` no pointerdown, nunca elástico.

## Colors

Paleta extraída direto dos logos e peças oficiais da marca — não é uma paleta de UI genérica
aplicada por cima.

### Primary
- **Navy Institucional** (`#1C2748`): cor estrutural — sidebar (fundo profundo em
  `Navy Profundo` `#141C36`), estado ativo, foco. É a cor que diz "isto é o sistema", não "isto é
  a ação".

### Secondary
- **Laranja Cirúrgico** (`#E8731B`): a única cor de ação do produto — CTA, indicador de item
  ativo no menu, prioridade crítica. Hover/pressed em `Laranja Pressionado` (`#D2630F`); fundo de
  selo/realce em `Laranja Suave` (`#FBEEE0`).
- **Âmbar** (`#F4A300`): cor de fechamento de gradiente — papel de apoio, não usada como cor de
  ação independente.

### Neutral
- **Papel** (`#F4F2EC`): fundo principal do app — quente de propósito, marca de identidade contra
  dashboard genérico.
- **Superfície de Card** (`#FFFFFF`): toda superfície elevada (card, modal, input, tabela).
- **Linha** (`#E5E2D9`) / **Linha Suave** (`#EDEAE2`): hairline quente de borda de card e divisor
  interno — a costura visual do sistema.
- **Tinta** (`#1A2138`), **Tinta 2** (`#585E72`), **Tinta 3** (`#8C8F9B`), **Tinta 4** (`#B4B6BE`):
  escala de texto principal → secundário → terciário/legenda → placeholder.
- **Tinta Nav** (`#A8B0CC`): texto sobre a sidebar navy. Não flipa no tema escuro — a sidebar
  continua escura nos dois temas, então este token é fixo (achado real ao migrar `HomePage.tsx`,
  ver comentário em `src/index.css`).

### Status semântico
Cada estado (`sucesso`, `alerta`, `perigo`, `info`) tem um trio texto/fundo/borda —
`{estado}` / `{estado}-suave` / `{estado}-linha` — sempre consumido por nome, nunca hex, pra
responder ao tema sem lógica `dark:` por chamada. `Sucesso` (`#1A7A3B`) e `Alerta` (`#9A5A00`)
foram deliberadamente escurecidos em relação ao hex original do produto porque o par contra o
próprio `-suave` batia só 3.75:1/3.80:1 — abaixo do mínimo AA de 4.5:1.

### Named Rules
**A Regra do Laranja Raro.** Laranja cirúrgico aparece só em CTA, indicador ativo e prioridade
crítica — nunca como cor decorativa ou de preenchimento de área grande. A raridade é o que faz o
olho parar nele.

**A Regra do Hairline.** Separação de superfície vem de borda quente (`linha`/`linha-soft`)
primeiro, sombra depois — nunca sombra pesada como recurso principal de hierarquia.

## Typography

**Body Font:** Poppins (com fallback `system-ui, sans-serif`)
**Label/Mono Font:** Saira (com fallback `system-ui, sans-serif`) — só para número tabular

**Character:** Poppins carrega texto corrido, título e label com peso direto, sem serifa, sem
ornamento — legível em tabela densa. Saira entra só quando o valor é numérico e precisa de largura
de dígito constante (KPI, coluna monetária, contador) — nunca pra texto corrido.

### Hierarchy
- **Display** (600, 2rem, line-height 1.1, tracking -0.02em): título de maior destaque — raro,
  topo de página de alto nível.
- **Title** (600, 1.25rem, line-height 1.15, tracking -0.01em): `page-title` — título de página
  padrão.
- **Heading** (600, 1rem, line-height 1.25, tracking -0.006em): título de seção/card dentro da
  página.
- **Body** (400, 0.875rem, line-height 1.5): texto corrido padrão do produto.
- **Body Small** (400, 0.8125rem, line-height 1.5, tracking 0.002em): texto secundário/denso.
- **Caption** (600, 0.75rem, line-height 1.4, tracking 0.01em): label de botão, badge, legenda de
  formulário — sempre semibold, nunca regular.
- **Micro** (600, 0.6875rem, line-height 1.35, tracking 0.02em, caixa-alta): cabeçalho de grupo de
  menu (`MÓDULOS`, `CONFIGURAÇÕES`) — sempre `uppercase tracking-widest`.
- **Número Tabular** (Saira, 600, `tabular-nums`): todo valor numérico em tabela, KPI ou coluna
  monetária. Nunca "dança" de largura ao atualizar.

### Named Rules
**A Regra do Número em Saira.** Todo número que representa um dado (não um rótulo) usa
`font-brand` (Saira) + `tabular-nums`. Texto corrido nunca usa Saira.

## Layout

Shell fixo de altura de tela (`h-screen overflow-hidden`) com sidebar lateral fixa (`w-56`
expandida / `w-14` colapsada em desktop `lg:`, drawer deslizante `w-64` com scrim em mobile) e área
de conteúdo rolável. Breakpoint de colapso mobile↔desktop é `lg` (1024px, padrão Tailwind) — abaixo
disso a sidebar vira drawer com `-translate-x-full`/`translate-x-0` e overlay `bg-navy-deep/55`.

Página de conteúdo segue `page-stack` (`flex flex-col gap-4`) → `page-header` (`flex-col` no
mobile, `flex-row justify-between` a partir de `sm`) → `surface-card` (bordas `rounded-xl`,
`border-line`, `shadow-raised`) contendo `surface-header` + corpo. Densidade é alta e consistente:
`px-3.5 py-3` em header de card, `px-2 py-1.5` em item de menu, `px-2.5 py-1.5` em input — nada de
respiro generoso tipo landing page.

## Elevation & Depth

Sistema híbrido: sombra sutil no tema claro (`shadow-raised` → `shadow-overlay` → `shadow-modal` →
`shadow-drawer`, crescendo monotonicamente, derivada sempre do navy — nunca preto puro). No tema
escuro a sombra recua e a separação passa a vir só de borda de 1px (`rgba(255,255,255,0.03-0.06)`)
— decisão explícita registrada em código (E00-S20 AC-1): sombra sobre fundo escuro lê mal, borda
não.

### Shadow Vocabulary
- **Raised** (`0 1px 2px rgba(20,28,54,.06), 0 1px 1px rgba(20,28,54,.04)`): repouso — card,
  superfície padrão.
- **Overlay** (`0 4px 10px rgba(20,28,54,.1), 0 2px 4px rgba(20,28,54,.06)`): popover, toast.
- **Modal** (`0 16px 32px rgba(20,28,54,.16), 0 4px 10px rgba(20,28,54,.08)`): modal centrado.
- **Drawer** (`0 24px 48px rgba(20,28,54,.2), 0 8px 16px rgba(20,28,54,.1)`): sidebar mobile,
  painel lateral.

### Named Rules
**A Regra da Sombra Navy.** Toda sombra deriva de `rgba(20,28,54,…)` — nunca preto puro
(`rgba(0,0,0,…)`) no tema claro. No escuro, sombra vira borda.

## Shapes

Raio cresce em 4 degraus pequenos (`4px` / `6px` / `8px` / `10px`) — nada de raio grande tipo
cartão de landing page; a escala foi calibrada pelo uso real do código (`6px`/`8px` dominavam
antes da tokenização, `14px` nunca existiu). Botão e input usam `md` (6px); card, modal e empty
state usam `xl` (10px); badge é sempre `rounded-full`. Bordas são sempre 1px, cor `linha`/
`linha-soft`, nunca decorativas.

## Components

Todo componente vem de `packages/ui` — não há reimplementação local de botão, card, badge, modal,
input, tabela ou toast em nenhuma feature.

### Buttons
- **Shape:** `rounded-md` (6px), altura fixa por tamanho (`sm` 32px / `md` 36px) — largura nunca
  salta entre estado normal e `loading`.
- **Primary** (`bg-navy` texto branco): ação padrão de página.
- **Accent** (`bg-orange` texto branco): a única cor de ação — usar com a Regra do Laranja Raro.
- **Secondary** (borda `linha`, fundo `card`, texto `tinta-2`): ação secundária/cancelar.
- **Ghost** (sem borda, texto `tinta-2`): ação terciária, dentro de toolbar densa.
- **Danger** (`bg-danger`): ação destrutiva.
- **Hover / Focus:** hover troca só a cor de fundo (nunca escala); `active:scale-[0.97]` no
  pointerdown, não no click — feedback é instantâneo. Foco visível: anel laranja
  `color-mix(orange 75%, transparent)`, 2px, offset 2px, em todo elemento focável do app.
- **Loading:** substitui ícone por spinner (`animate-spin`, borda 2px), nunca muda largura;
  resolve via `finally` do chamador, nunca trava sozinho.

### Badges
- **Style:** `rounded-full`, `px-2 py-0.5`, texto 11px semibold, fundo `-soft` + texto sólido do
  tom (`neutral`/`success`/`warning`/`danger`/`info`/`accent`).
- **State:** sem interação — é rótulo, não botão.

### Cards / Containers
- **Corner Style:** `rounded-xl` (10px).
- **Background:** `superficie-card` (branco), header interno `bg-paper/45`.
- **Shadow Strategy:** `shadow-raised` (ver Elevation).
- **Border:** 1px `linha` no card, `linha-soft` no divisor de header.
- **Internal Padding:** header `px-3.5 py-3` (`sm:px-4`), corpo segue o conteúdo.

### Inputs / Fields
- **Style:** `h-9`, `rounded-md`, borda `linha`, fundo `card`, texto `caption`, placeholder
  `tinta-4`.
- **Focus:** borda vira `navy` + anel `ring-2 ring-navy/10` — sem glow, sem mudança de tamanho.
- **Error / Disabled:** erro é comunicado pelo `Field` (label + texto vermelho `role="alert"`
  abaixo, não pela borda do input mudar de cor sozinha); disabled é fundo `linha-soft` + texto
  `tinta-3`.
- **Field wrapper:** todo campo usa `Field` — label + controle + ajuda + erro amarrados por
  `id`/`aria-describedby`/`aria-invalid` gerados automaticamente, nunca montado à mão.

### Navigation (Sidebar)
- **Style:** fundo `navy-deep`, texto `tinta-nav` inativo → branco no hover/ativo. Item ativo
  ganha borda esquerda laranja (`border-l-2 border-orange`) + fundo `bg-card/[0.07]` + peso medium
  — nunca só muda a cor do texto.
- **Grouping:** cabeçalho de grupo em `Micro` caixa-alta (`MÓDULOS`, `CONFIGURAÇÕES`,
  `OPERAÇÃO`, `CADASTROS`…), omitido quando a sidebar está colapsada.
- **Collapse:** modo colapsado (`lg:w-14`) mostra só ícone, centralizado, com `title` como
  fallback de rótulo.
- **Mobile:** vira drawer (`w-64`, `fixed`, `translate-x-*`) com scrim `bg-navy-deep/55
  backdrop-blur`, fecha ao navegar.

### Data Table
- **Header:** sticky (`sticky top-0`), fundo `paper`, texto 11px `tinta-3`, ordenável via
  `aria-sort`.
- **Body:** número sempre alinhado à direita e em `tabular-nums`; scroll horizontal contido no
  wrapper da tabela, nunca no `body` da página.
- **Loading:** linha fantasma (`Skeleton`) na largura real da coluna — nunca spinner centralizado;
  só aparece se a carga passar de 200ms, fica visível no mínimo 400ms (evita flash).
- **Empty:** distingue "nunca houve registro" de "filtro zerou" — mensagem e ação diferentes
  (`EmptyState` variante `vazio`/`filtrado`).

### Toast
- **Position:** canto inferior direito, entra/sai do mesmo lado (`translateY(8px)`), nunca
  centralizado.
- **Queue:** no máximo 3 visíveis + contador "+N mais" — nunca cobre a tela num import em lote.
- **Dismiss:** sucesso/info somem sozinhos em 4s; erro/aviso ficam até o usuário dispensar
  (`role="alert"`/`aria-live="assertive"` só no erro).

### Modal
- **Style:** `rounded-xl`, `shadow-modal`, entra com scale 0.96→1 + fade (nunca de `scale(0)`) via
  `data-state` do Radix.
- **Focus:** preso e devolvido pelo Radix; `Escape` e clique no scrim fecham; suporte a
  `data-autofoco` pra mandar o foco inicial pro botão não-destrutivo em confirmação.

## Do's and Don'ts

### Do:
- **Do** consumir cor sempre por nome de token semântico (`text-success`, `bg-danger-soft`) —
  nunca hex cru, nem lógica `dark:` por chamada.
- **Do** usar `Saira`/`tabular-nums` (`NumeroTabular`) em todo valor numérico de tabela/KPI.
- **Do** reusar `packages/ui` (`Button`, `Card`, `Badge`, `Input`, `Field`, `DataTable`, `Modal`,
  `Toast`) em vez de montar variante local.
- **Do** respeitar `prefers-reduced-motion` — toda animação do sistema já tem fallback estático
  (rede de segurança universal em `src/index.css`).
- **Do** manter o anel de foco visível (laranja, 2px + offset) em todo elemento interativo.

### Don't:
- **Don't** usar laranja cirúrgico como cor decorativa ou de preenchimento de área grande — é ação
  rara, não acento.
- **Don't** usar sombra preta pura (`rgba(0,0,0,…)`) — toda sombra deriva do navy.
- **Don't** aplicar `--color-ink-*` sobre a sidebar navy — o texto de sidebar é `tinta-nav`, fixo
  nos dois temas (achado documentado em `src/index.css`).
- **Don't** montar modal, toast, tabela ou input à mão numa feature — são 28+13+12 casos já
  unificados; nova ocorrência manual é regressão, não exceção.
- **Don't** deixar `carregando`/`vazio` sem distinguir "nunca houve dado" de "filtro zerou".
