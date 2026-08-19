---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Só a sessão mais recente fica aqui. Histórico completo, cronológico, em
> `docs/state-historico/` (índice: [INDEX.md](state-historico/INDEX.md)) — arquivado, não
> carregado por padrão. Regra de rotação em `.claude/skills/handoff/SKILL.md`.

## 2026-08-18 — Lote visual E00-S14..S23: migração mecânica (S17/S18) + verificação (S19/S22) — parte 2 (Claude)

Continuação da sessão que fez a fundação em 2026-08-07 (tokens de cor, `packages/ui`, toast/
confirmação — ver `docs/state-historico/2026-07-21-a-2026-08-11.md`). Lucas pediu pra implementar
o lote visual inteiro; decisão explícita dele, por `AskUserQuestion`: sequência completa sem
parar, branch única do lote com commit por story, migração mecânica completa nesta sessão,
**pular S21** (reescreve `HomePage.tsx` em produção sem navegador pra validar) e, quando S17/S18
também esbarraram no mesmo problema (julgamento visual em massa sem navegador), Lucas escolheu
**continuar mesmo assim, aceitando o risco**. S20 teve o mesmo risco de S21 identificado durante o
trabalho (AC-4/5 mexem no mesmo `HomePage.tsx`) — perguntado de novo, Lucas escolheu **pular**.

Branch: `feat/E00-lote-visual-S14-S23` (local, não pushed — sem PR aberto; `.claude/memory/
feedback-perguntar-antes-de-pr.md` exige confirmar com Lucas antes do `gh pr create`).

**E00-S17 (skeleton) — implementado.** AC-1: dois codemods (`codemod-skeleton-pagina.mjs` pro
padrão dominante de página inteira, 49 arquivos/65 ocorrências; `codemod-skeleton-inline.mjs` pras
variações menores em `<p>`/`<div>` dentro de ternário/`return`/`&&`, 27 arquivos/36 ocorrências) —
contagem de "Carregando" renderizado caiu a 0, verificado por grep. AC-3: `setEstado({ fase:
"carregando" })` incondicional (que apagava a lista já exibida a cada recarga pós-mutação) virou
`setEstado((atual) => (atual.fase === "pronto" ? atual : { fase: "carregando" }))` em 41 arquivos
— mesmo padrão que `LancamentosPage.tsx` já usava manualmente. AC-2: hook `useCargaVisivel`
(200ms delay / 400ms mínimo) já existia testado mas sem nenhum consumidor — ligado dentro do
`DataTable` (`packages/ui`), cobre as 12 telas baseadas em tabela com uma mudança só; os ~76
skeletons de página inteira do AC-1 continuam sem debounce (heterogêneos demais — `isPending`,
`fase==='carregando'`, estado local — pra mexer em massa sem navegador; registrado, não
escondido). AC-6: 9 telas (`LancamentosPage`, `ListaClientesPage`, `TiposTarefaPage`,
`OrdensServicoPage`, `EquipamentosPage`, `CatalogoSimplesPage`, `InspecoesPage` ×2,
`ConversaLista`) ganharam distinção real "nunca houve registro" × "filtro zerou" (mensagem própria
+ ação de limpar filtro/busca) — `ContasPage` (comercial) já fazia isso certo desde a fundação.
AC-4 (`:active` no `Button`) e AC-5 (reticência única, gate) já vinham prontos.

**E00-S18 (tipografia) — implementado.** AC-1/2/3 (escala de 7 degraus em `rem`, tracking e
entrelinha por degrau) já existiam em `index.css` desde a fundação. Rollout mecânico e
value-preserving (mesmo px, só troca de nome) de `text-xs/sm/base/xl` → `caption/body/heading/
title` via `codemod-tipografia-escala.mjs`: 149 arquivos, 1987 ocorrências. AC-5 (hierarquia real,
um `<h1>` por tela): promoção manual de `<h2>`/`<h3>` → `<h1>` em 51 páginas (script
`promover-h1.mjs`, alvo por arquivo:linha, não regex cego — vários arquivos têm outros `h2`/`h3`
de modal/card com estilo parecido); gap encontrado e fechado nesta parte 2 — `Atendimento
ConfigPage`/`InboxPage` não tinham heading de título nenhum (só guarda "Acesso restrito"), a
primeira ganhou `<h1>` visível, a segunda (layout de inbox sem espaço visual pro título) ganhou
`<h1 className="sr-only">`.

**E00-S19 (movimento) — verificado, sem gap.** Curvas `--ease-*`, gate `movimento` (0
`transition-all`, sem lib proibida — ADR-0018), `prefers-reduced-motion` cobrindo overlay/surface/
toast/shimmer do skeleton, `:active` no `Button` — tudo já estava na fundação. Só confirmado
nesta sessão, nenhuma mudança necessária.

**E00-S20 (materiais/chrome) — parcial, resto pulado por decisão do Lucas.** AC-1/2/3 (4 degraus
de sombra derivados do navy, `rgba(20,28,54,...)`, override no escuro) já prontos. AC-4/5 (chrome
translúcido com scroll por baixo) exigiriam reestruturar o `flex-col` de `HomePage.tsx` (header e
`<main>` são irmãos, não sobrepostos — mesmo arquivo de alto risco do S21); AC-6 (scrim × painel
não-bloqueante) pede trocar o tratamento visual de vários drawers (ex: `DrawerDetalheAtivo`, que
hoje usa scrim escuro mesmo sendo um "detalhe lateral" — o exemplo canônico de não-bloqueante
citado na própria spec). Perguntado, Lucas escolheu pular — mesma lógica do S21.

**E00-S21 — não implementado, decisão de sessão anterior mantida.** `design.md` pronto, aguardando
review. Reescreve a navegação inteira de `HomePage.tsx` em produção sem navegador pra validar
visualmente — risco alto demais pra esta sessão.

**E00-S22 (dark mode/a11y) — parcial.** Verificado sem mudança: AC-2 (`ThemeProvider` já resolve
`prefers-color-scheme` como padrão, escolha explícita em `localStorage` vence e persiste, `html,
html * { transition: background-color, border-color, color }` faz a troca suave), AC-4 (gate
`div-clicavel` verde), AC-5 (`Toast` já tem `aria-live` polite/assertive por `tone`, `Field` já
liga `aria-describedby`/`aria-invalid` automático). Implementado nesta sessão: AC-8
(`@media (prefers-contrast: more)` em `index.css` — `--color-line` mais visível, `--color-ink-3`
sobe pro nível de `--color-ink-2`; só ativa sob a media query, zero efeito no padrão). Pendente:
AC-1 (revisão visual das 56 telas nos 2 temas — gate humano por definição), AC-3 (percurso só de
teclado), AC-6 (`axe-core` no Playwright/CI — infraestrutura de teste não existe ainda), AC-7
(alvo de toque ≥44px — risco real de sobrepor botões adjacentes sem poder ver o resultado).

**E00-S23 — não implementado.** Componente novo de física de gesto (arrasto 1:1, decisão por
velocidade na soltura, interrupção sem salto, rubber-band) — é literalmente o tipo de trabalho que
mais precisa de dispositivo/navegador real pra validar corretamente. Mesma categoria de risco do
S20/S21; não tentado às cegas.

**Gates:** `pnpm run ci:local` (19 gates) verde a cada commit desta sessão — alguns runs isolados
de `testes` falharam de forma intermitente (sem relação com o código alterado; nunca reproduziu na
segunda tentativa, tratado como flakiness do ambiente, não bug).

**`docs/epics/ROADMAP.md` atualizado** com o status real de S17–S23 (linhas da tabela do lote
visual). **`docs/STATE.md` rotacionado** nesta sessão: tudo antes de 2026-08-11 (a maior parte do
arquivo, ~2200 linhas) moveu pra `docs/state-historico/2026-07-21-a-2026-08-11.md` — o arquivo
tinha crescido muito além do limite de ~250 linhas da regra de rotação.

## Em andamento / próximo passo
Branch `feat/E00-lote-visual-S14-S23` local, sem PR aberto — perguntar ao Lucas antes de abrir
(`gh pr create`), por instrução permanente dele. Se ele quiser continuar o lote: os itens
pendentes documentados acima (S17 AC-2 no resto dos skeletons, S20 AC-4/5/6, S21 inteira, S22
AC-1/3/6/7, S23 inteira) todos compartilham o mesmo bloqueio — precisam de navegador/dispositivo
real pra validar, não código às cegas.

## Bloqueios abertos
> Carregados da rotação desta sessão — confirmados como ainda abertos, não copiados às cegas.
- [ ] **`.claude/skills/revisao-adversarial/SKILL.md` nunca foi criada** — referenciada em
  `AGENTS.md`/`Definition-of-Done.md` desde 2026-07-02, conteúdo nunca materializado como skill de
  verdade (confirmado ausente em `.claude/skills/` nesta sessão). Quem destrava: Lucas, com pedido
  direto.
- [ ] **Rotacionar o JWT secret legado do projeto Supabase** — exposto sem querer num diagnóstico
  de sessão em 2026-07-02. Não catastrófico, mas é boa prática. Quem destrava: @devops/Lucas.
- [ ] **Lote visual E00-S14..S23 sem navegador pra validar visualmente** — toda a migração
  mecânica desta sessão (S17/S18 completos, ~2700 ocorrências trocadas em ~150 arquivos) passou
  pelos gates estáticos e `ci:local`, mas nenhuma tela foi vista renderizada. Quem destrava:
  sessão com Playwright/`claude-in-chrome` disponível, ou revisão humana do Lucas antes do PR.
