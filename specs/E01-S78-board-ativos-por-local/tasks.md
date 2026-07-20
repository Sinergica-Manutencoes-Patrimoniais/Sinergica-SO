---
name: tasks-E01-S78-board-ativos-por-local
description: Decomposição e gates — board de ativos por Local + drawer de detalhe.
alwaysApply: false
---

# Tasks — Board de ativos por Local + detalhe do ativo

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|-----------|----------------|--------|
| 1 [P] | domain `board-ativos.ts`: tipos (`ColunaBoard`, `SubGrupoLocal`, `ItemCard`) + `montarColunasBoard(area, locais, itens)` puro (nível-1 + subgrupos + coluna "Sem local") + `.test.ts` | AC-2, AC-3 | — | `pnpm test` | ☐ |
| 2 | application `board-ativos-gateway.ts` (porta: `listarItensDoCliente`, `listarHistoricoOsItem`) + `board-ativos.ts` (`montarBoard` compõe `HierarquiaGateway` + itens; `obterDetalheAtivo` = `obterContextoItem` + histórico) | AC-1, AC-5, AC-6 | 1 | `pnpm typecheck` | ☐ |
| 3 | infra `supabase-board-ativos-adapter.ts`: `listarItensDoCliente(clienteId)` (itens ativos do cliente com `local_id`); `listarHistoricoOsItem(itemId)` (join `os_equipamentos_auvo`→`ordens_servico` por `auvo_equipment_id`, degrada p/ vazio) | AC-1, AC-6 | 2 | `pnpm typecheck` | ☐ |
| 4 | UI `components/BoardAtivos.tsx`: seletor de Área, colunas nível-1, subgrupos, coluna "Sem local", card do item (ícone tipo/foto/status), estado vazio→Estrutura | AC-1, AC-2, AC-3, AC-4, AC-7 | 3 | `pnpm build` | ☐ |
| 5 | UI `components/DrawerDetalheAtivo.tsx`: breadcrumb, foto, sistemas, componentes filhos (via `obterContextoItem`) + histórico de OS/última manutenção; fecha X/Esc; degrada seção de histórico | AC-5, AC-6 | 3 | `pnpm build` | ☐ |
| 6 | Wire aba "board" em `VisaoClientePage.tsx` (`Aba360` + `ABAS` + branch de render) | AC-1, AC-7 | 4, 5 | `pnpm build` | ☐ |
| 7 | Playwright `board-ativos.spec.ts`: abrir aba Board, trocar Área, abrir drawer, ver breadcrumb+sistemas+histórico, fechar por Esc | AC-1..AC-7 | 6 | `pnpm exec playwright test` | ☐ |
| 8 | Glossário ("Board de ativos") + ROADMAP + STATE | — | todas | `pnpm run ci:local` | ☐ |

`[P]` = paralelizável. Sem migration. Um commit por task, escopo `feat(E01-S78): ...`.

## Plano de teste
- **Unidade (Vitest):** `montarColunasBoard` — itens no local nível-1 (sem subgrupo), itens em sub-local (subgrupo por sub-local), itens sem local (coluna "Sem local"), local nível-1 vazio (coluna vazia), item de outra área ignorado.
- **Aceite (Playwright, dev server local — Supabase de PRODUÇÃO, NUNCA URL Netlify):** abrir a Visão de um cliente com Áreas → aba Board → trocar de Área → clicar num card → conferir breadcrumb, chips de sistema e histórico de OS no drawer → fechar por Esc. Conferir que as abas antigas seguem intactas (AC-7).

## Divergências (SPEC_DEVIATION)
(nenhuma até agora)

## Checklist de Definition of Done
- [x] AC-1..AC-7 verdes (unit `montarColunasBoard` 6/6 + Playwright contra produção real)
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] `pnpm run ci:local` verde (412 testes; ajuste: artefatos Playwright no ignore do biome)
- [x] Playwright `board-ativos.spec.ts` 1/1 no dev server local (Supabase de produção)
- [x] Glossário ("Board de ativos") + ROADMAP + `docs/STATE.md` atualizados
