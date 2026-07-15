---
name: tasks
description: Decomposição e gates — refinamento UX PCM (lista+histórico de ferramenta, OS expandível, densidade, horas navegável).
alwaysApply: false
---

# Tasks — E01-S75 · Refinamento UX do PCM

> Marcar owner no ROADMAP. Branch: `feat/E01-S75-refinamento-ux-pcm`. **Frontend-only, ZERO
> migration** — nenhum arquivo em `supabase/`. Ler `spec.md` antes. As âncoras de `arquivo:linha`
> estão no `spec.md` (seção Rastreabilidade) — confirmar que ainda batem antes de editar (o código
> pode ter mudado desde a exploração de 2026-07-14).

## Contexto rápido pro executor (Sonnet)
- Este é o refino visual/UX pós-verificação Playwright da leva E01-S68..S74. Tudo já está mergeado
  e funcionando; aqui é polir.
- **Reusar o que existe.** O sistema de design mora em `apps/web/src/index.css` (classes `.btn-*`,
  `.surface-card`, `.input`, `.status-error`, `.modal-panel`, tokens `@theme`). `OrdensServicoPage`
  é o benchmark de densidade. Não criar biblioteca nem redesign.
- **`listarHistoricoUnidade` já existe** (gateway/application/adapter) — só falta a UI chamar.
- **`DetalhesTarefaAuvo` já renderiza** questionários (pergunta→resposta) e fotos (`<img>`) — só
  falta espaço/expansão.
- A navegação entre views do PCM é `useState` em `HomePage` (`pcmView` + `irParaPcmView`), com
  precedente de passar params (`clienteSelecionado`, `osDeepLink`/`osIdInicialToken`). Seguir esse
  padrão pro item 5 (novo campo de estado + setter + prop na página destino).

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Horas clicável (item 5).** `ApontamentoHorasPage.tsx`: linhas por cliente/técnico viram clicáveis (pular `chave === "sem-vinculo"`), com callbacks `onAbrirCliente(clienteId, {inicio,fim})` / `onAbrirTecnico(tecnicoId, {inicio,fim})`. `HomePage.tsx`: novo estado `navPcmParam` `{tipo:'cliente'\|'tecnico', id, inicio, fim, seq}` (padrão `osDeepLink`), setter que troca a view + passa param; `irParaPcmView` limpa. `VisaoClientePage.tsx`: prop opcional `periodo?={inicio,fim}` — filtra **client-side** as listas de OS/backlog/histórico já carregadas (não tocar gateway/adapter). `OrdensServicoPage.tsx`: prop opcional `filtrosIniciais?: Partial<FiltrosOrdens>` que semeia o `useState` de `filtros` no mount | AC-5 | — | `pnpm run test` | todo |
| 2 | **OS expandível + Auvo visível (itens 2+3).** `OrdensServicoPage.tsx`: rebalancear o grid (dar mais largura ao detalhe; remover o vazio do `self-start` — ex. deixar o detalhe esticar ou usar coluna mais larga); adicionar botão **"Expandir"** no header do `DetalheOs` que abre um modal grande (`.modal-panel`, ~`max-w-4xl`) com `Info` + `DetalhesTarefaAuvo` (as 7 abas). Reusar `DetalhesTarefaAuvo.tsx` como está. **Não** mexer no `NovaOrdemServicoModal` (questionários/fotos são Auvo read-only — decisão vinculante do `spec.md`, AC-3) | AC-2, AC-3 | — | `pnpm run test` | todo |
| 3 | **Ferramentas em lista + histórico (item 1).** Extrair o render de `HistoricoModal` (`FerramentasPorTecnicoPage.tsx:447-494`) para `components/HistoricoMovimentacoesModal.tsx` (props: título + `MovimentacaoFerramentaItem[]`), e fazer as duas telas reusarem. `FerramentasPage.tsx`: trocar o card grid pela **lista densa** (linha por ferramenta, padrão `divide-y divide-line-soft`/`px-3 py-2`/`text-xs`); manter expand para unidades; cada unidade mostra codigo/status/quem/`atribuidaEm` + botão "Histórico" que chama `listarHistoricoUnidade(unidade.id)` e abre o modal extraído | AC-1 | — | `pnpm run test` | todo |
| 4 | **Densidade + polimento (itens 4+6, transversal — por último).** `FerramentasPage.tsx` (o que sobrou), `EquipamentosPage.tsx`, `BacklogGutPage.tsx`: cards `p-4`→`p-3`, botões hand-rolled → `.btn-accent`/`.btn-secondary`, thumbnails `h-12/h-14`→`h-10`, `gap-4`→`gap-3`, `text-base`→`text-sm` onde couber. Substituir box de erro hex duplicado por `.status-error`; extrair helper de pill de status (cores atuais). Se precisar, 1-2 classes novas em `index.css` (`.list-row` p/ a lista de ferramenta). Manter identidade | AC-4, AC-6 | 1, 2, 3 | `pnpm run test` | todo |
| 5 | **Gates + verificação.** Rodar gates; Playwright contra produção (suíte `apps/web/e2e/`, usuário no `.env.local`): expandir unidade→histórico; OS expandir→aba Questionários/Anexos; horas clicar cliente→360 no período, técnico→OS filtrada. Screenshots antes/depois do polimento. Atualizar ROADMAP/STATE | todos | 1-4 | ver "Gates" abaixo | todo |

## Gates (task 5) — rodar individualmente (não há `lint:migrations` novo; zero migration)
`./node_modules/.bin/biome check --write .` · `pnpm run typecheck` · `pnpm run test` ·
`pnpm run build` · `pnpm run arch:check` · `pnpm run check:edge-functions` ·
`pnpm run audit:esteira` · `pnpm run eval:spec` · `node scripts/validate-mermaid.mjs`.
> Nota (aprendida na leva anterior): `pnpm run ci:local` reporta "no matching push files" fora de um
> `git push` real — rodar os gates individualmente. Se `pnpm exec biome` der OOM, usar o binário
> direto (`./node_modules/.bin/biome`). Playwright: `pnpm --filter @sinergica/web test:e2e`.

## Plano de teste
- Unit: nenhum domínio novo obrigatório (é UI). Se extrair lógica de filtro-por-período do
  cliente-360, cobrir com teste puro.
- Playwright (`apps/web/e2e/`): estender a suíte — 1 spec por item verificável (ferramenta histórico,
  OS expandir, horas navegação). Dados de teste com prefixo `[TESTE E2E]`, limpos ao fim onde houver
  exclusão na UI.
- Visual: screenshots antes/depois das telas densificadas (item 4).

## Decisões de escopo (registrar como divergência só se mudar na implementação)
- **AC-3 — Auvo read-only.** Questionários/fotos NÃO vão pro form de edição; só visualização no
  detalhe. Se o executor achar que precisa editá-los, PARAR e sinalizar (contradiz o system of
  record; ver `docs/adr/0001-*`).
- **AC-5 — filtro de período client-side.** Cliente-360 filtra por período **sobre dados já
  carregados**, sem novo parâmetro de data no gateway/adapter. Se o volume tornar isso inviável,
  virar decisão consciente (nova task, não silenciosa).
- **Grupo/almoxarifado adiado.** O container físico (bolsa/maleta) discutido com o PO **não** entra
  aqui — story futura.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC-1..AC-6 verdes pelo comando/verificação · gates individuais verdes · Playwright cobrindo os
  fluxos · sem `SPEC_DEVIATION` pendente · ROADMAP/STATE atualizados
- [ ] Zero arquivo em `supabase/` no diff (é frontend-only — se aparecer migration, algo saiu do
  escopo)
- [ ] Screenshots antes/depois do polimento anexados no PR
