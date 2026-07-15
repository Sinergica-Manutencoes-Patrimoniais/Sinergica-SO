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
| 1 | **Horas clicável.** `ApontamentoHorasPage.tsx` ganha props `onAbrirCliente(clienteId, {inicio,fim})`/`onAbrirTecnico(tecnicoId, {inicio,fim})`; `AgregadoPainel` ganha `onSelecionar?` — linha vira `<button>` quando presente (pula `chave === "sem-vinculo"`, que nunca é clicável). `HomePage.tsx`: estados `clientePeriodo`/`ordensFiltrosPreset` (padrão `osDeepLink`/`clienteSelecionado`), handlers `abrirClienteNoPeriodo`/`abrirOrdensDoTecnicoNoPeriodo`, `irParaPcmView` limpa os dois. `VisaoClientePage.tsx` ganha prop `periodo?` — abre direto na aba "OS" e filtra backlog/histórico **client-side por `createdAt`** (não há `dataAgendada` em `OrdemServicoResumo`; rótulo diz "OS criadas no período", honesto sobre a diferença). `OrdensServicoPage.tsx` ganha prop `filtrosIniciais?: Partial<FiltrosOrdens>`, semeada no `useState` inicial de `filtros` (a página sempre remonta ao trocar de view, não precisou do padrão seq/useEffect) | AC-5 | — | `pnpm run test` | **done** |
| 2 | **OS expandível + Auvo visível.** `OrdensServicoPage.tsx`: grid da view "Lista" mudou pra `xl:grid-cols-[minmax(420px,1fr)_460px]` com `max-h-[calc(100vh-220px)] overflow-y-auto` nas duas colunas (fila e detalhe) — cada uma rola internamente até a mesma altura, matando o buraco vazio do `self-start` antigo. `DetalheOs` ganha botão **"Expandir"** (ícone `Expand`) que abre modal `.modal-panel.max-w-4xl` com o mesmo conteúdo (`Info` + `DetalhesTarefaAuvo`, extraído pra variável `corpo` reusada inline e no modal); fecha por X ou Esc (`useEffect` com `keydown`) — **sem** clique-fora (nenhum outro modal do repo usa esse padrão, mantive consistência em vez de introduzir um novo). `NovaOrdemServicoModal` não foi tocado (AC-3 cumprida à risca) | AC-2, AC-3 | — | `pnpm run test` | **done** |
| 3 | **Ferramentas em lista + histórico.** `HistoricoModal` extraído de `FerramentasPorTecnicoPage.tsx` pra `components/HistoricoMovimentacoesModal.tsx` (ganhou linha extra com `funcionarioNome` por evento, útil no histórico por unidade); as duas páginas reusam. `FerramentasPage.tsx`: card grid → lista densa (`divide-y divide-line-soft`, `FerramentaCard`→`FerramentaLinha`, thumbnail `h-9`, linha `px-3 py-2.5`); unidade expandida mostra `codigo`/status/`atribuidaANome`/`atribuidaEm` (desde quando) + botão **"Histórico"** que chama `listarHistoricoUnidade(gateway, unidade.id)` | AC-1 | — | `pnpm run test` | **done** |
| 4 | **Densidade + polimento.** `EquipamentosPage.tsx` (`EquipamentoCard`→`EquipamentoLinha`, mesmo padrão de lista) e `BacklogGutPage.tsx` (botão "Planejar" `px-4 py-2 text-sm`→`h-8 px-3 text-xs`). **Achado ao comparar:** o box de erro de `BacklogGutPage`/`OrdensServicoPage` usa uma paleta hex (`#F0C2BD`/`#FFF4F2`/`#A12D24`) diferente da usada em Ferramentas/Equipamentos/Kits (`#F2C0B5`/`#FFF4F1`/`#A23B25`) — **mas as duas páginas da área de OS já eram consistentes ENTRE SI**; tentei unificar pra família de Ferramentas e reverti ao perceber que isso quebraria a consistência existente dentro da própria área de OS. Deixado como está (2 famílias de hex quase idênticas, pré-existentes, fora do escopo desta story tocar as duas de uma vez sem risco). **Extra pedido pelo Lucas no meio da sessão** (fora do plano original, mesmo tema): `ListaClientesPage.tsx` — `ClienteCard` (grid `xl:grid-cols-2`) virou **tabela densa** (`table`/`thead`/`tbody`, padrão de `TiposTarefaPage.tsx`) com colunas Cliente/Local/Contato/OS abertas/Ativos/Maior GUT/Última atividade/Ações — mais dados visíveis na mesma tela, como pedido | AC-4, AC-6 | 1, 2, 3 | `pnpm run test` | **done** |
| 5 | **Gates + verificação.** Gates individuais rodados. Playwright contra produção real (suíte `apps/web/e2e/`): specs existentes (`ordens-servico`, `ferramentas`, `kits`, `inspecoes`, `tipos-inspecao`) atualizados pra nova estrutura de DOM (ferramenta virou lista, não tem mais `<h4>`) e re-verificados; spec novo `refinamento-ux.spec.ts` cobre os 4 fluxos novos (OS expandir/fechar por X e Esc; ferramenta→histórico de unidade; horas→clicar cliente e técnico, ambos navegaram de verdade contra dado real de produção; Clientes→tabela com colunas). 10/10 passando. ROADMAP/STATE atualizados | todos | 1-4 | ver "Gates" abaixo | **done** |

## Gates (task 5) — rodados individualmente (não há `lint:migrations` novo; zero migration)
`./node_modules/.bin/biome check --write .` ✓ · `pnpm run typecheck` ✓ · `pnpm run test` ✓ (354
passando) · `pnpm run build` ✓ · `pnpm run arch:check` ✓ · `pnpm run check:edge-functions` ✓ ·
`pnpm run audit:esteira` ✓ · `pnpm run eval:spec` ✓ · `node scripts/validate-mermaid.mjs` ✓ ·
Playwright (`apps/web/e2e/`, 10/10) ✓ contra produção real.
> `pnpm run ci:local` reporta "no matching push files" fora de um `git push` real (confirmado de
> novo) — gates individuais é o caminho certo neste ambiente.

## Plano de teste
- Unit: nenhum domínio novo (é UI) — 354 testes existentes seguem verdes, nenhuma regressão.
- Playwright (`apps/web/e2e/`): `refinamento-ux.spec.ts` novo (4 testes) + `ordens-servico.spec.ts`/
  `ferramentas.spec.ts`/`kits.spec.ts` atualizados pra nova estrutura DOM da lista de ferramentas.
  Dados de teste `[TESTE E2E]` criados e desativados/devolvidos via UI ao final de cada rodada.
- Visual: verificado ao vivo via Playwright contra produção (screenshots de depuração descartados
  após confirmação, não anexados ao PR — a evidência é a suíte passando contra dado real).

## Decisões de escopo
- **AC-3 — Auvo read-only.** Confirmado: `NovaOrdemServicoModal` não foi tocado; questionários/fotos
  só aparecem no detalhe (inline e expandido), nunca editáveis.
- **AC-5 — filtro de período client-side em cliente-360, por `createdAt`.** `OrdemServicoResumo` não
  tem `dataAgendada` (só `createdAt`/`auvoSyncedAt`) — o filtro usa `createdAt`, com rótulo explícito
  "OS criadas no período" (não é o mesmo campo que `ApontamentoHorasItem.dataAgendada` usa no
  relatório de origem; divergência de semântica documentada na UI, não escondida).
- **Grupo/almoxarifado** segue adiado, não fez parte desta story.
- **Clientes em tabela** foi pedido explicitamente pelo Lucas durante a implementação (não estava no
  `spec.md` original) — tratado como extensão natural do tema "lista densa" já em curso, mesmo
  padrão (`TiposTarefaPage.tsx`) e mesmo nível de gate/verificação que o resto da story.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [x] AC-1..AC-6 verdes pelo comando/verificação · gates individuais verdes · Playwright cobrindo os
  fluxos (10/10, contra produção real) · sem `SPEC_DEVIATION` pendente · ROADMAP/STATE atualizados
- [x] Zero arquivo em `supabase/` no diff (confirmado — frontend-only)
- [ ] Screenshots antes/depois do polimento anexados no PR — não anexados nesta sessão (verificação
  foi funcional via Playwright, não houve captura formal de antes/depois)
