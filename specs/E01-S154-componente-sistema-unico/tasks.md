---
name: tasks-E01-S154
description: Tasks da E01-S154 — renomear UI para Componente, esconder tipo/pai, Sistema 1:N.
alwaysApply: false
---

# Tasks — E01-S154 Componente (renomear) + Sistema 1:N

> Um commit por task: `feat(E01-S154): ...`. Paths relativos a `apps/web/src/` salvo indicação.
> Gate web: `pnpm --filter @sinergica/web exec vitest run <arquivo>`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Pré-checagem de duplicatas (somente leitura).** Rode no projeto Supabase linked: `select item_id, array_agg(sistema_id) from pcm.sistema_itens group by item_id having count(*) > 1;`. Resultado vazio: siga. Com linhas: **PARE**, reporte a lista ao Lucas e aguarde. | AC-3 | — | query retorna 0 linhas | **done** (0 linhas, 2026-09-30) |
| 2 | **Migration** `supabase/migrations/0216_E01-S154_sistema_itens_item_unico.sql`: `create unique index if not exists uq_sistema_itens_item_unico on pcm.sistema_itens (item_id);` + `drop index if exists pcm.idx_sistema_itens_item;` (redundante). pgTAP novo `supabase/tests/pcm_sistema_itens_unico.test.sql`. | AC-3 | 1 | `supabase test db` (CI `db-tests`) | **done** — migration aplicada em produção via API de gerência (sem Docker local pro pgTAP; roda na CI) |
| 3 | **Domínio**: `validarMembroSemOutroSistema` em `sistemas.ts` + `ItemComposicaoSistema.sistemaOutroNome` em `composicao-sistema.ts`. | AC-4 | — | `vitest run src/features/pcm/domain/sistemas.test.ts` | **done** (10 testes) |
| 4 | **Gateway/adapter**: `SistemaItemOpcao.sistemaId/sistemaNome` + `listarItensDisponiveis` resolve pertencimento atual. | AC-4 | 3 | `typecheck` | **done** |
| 5 | **Caso de uso**: `adicionarItem` valida antes do round-trip. | AC-4 | 3, 4 | `vitest run src/features/pcm/application/sistemas.test.ts` | **done** (7 testes) |
| 6 | **UI composição**: `ComposicaoSistema`/`SeletorItensComFiltro` desabilitam item de outro Sistema. | AC-4 | 4 | typecheck + vitest | **done** |
| 7 | **Modal sem tipo/pai**: removidos de `EquipamentoModal.tsx`; prop `equipamentosDisponiveis` removida (sem outro uso). | AC-2 | — | typecheck | **done** |
| 8 | **Renomear textos (AC-1)**: nav, modal, Nova OS, painel Auvo, badges tipo, mensagens de erro, glossário parcial. E2E `board-ativos`/`hierarquia-sistemas` atualizados. Filtro de tipo/badge em `EquipamentosPage`/`BoardAtivos`/`DrawerDetalheAtivo` renomeado pra "Principal"/"Subcomponente (legado)" (ambiguidade não coberta literalmente pela spec — decisão registrada aqui). | AC-1 | 7 | `pnpm run ci:local` (biome+tsc+vitest verdes; `lint:migrations` verde) | **done** |
| 9 | **Glossário** conforme AC-5. | AC-5 | — | `pnpm run audit:esteira` | **done** |
| 10 | **E2E**: cenário novo em `hierarquia-sistemas.spec.ts`. | AC-4, AC-1 | 2, 6, 8 | `playwright test --list` (estrutura ok) | **escrito, não executado** — falta `SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD` nesta máquina (mesma lacuna de `docs/STATE.md`) |

## Plano de teste
- Unidade: `validarMembroSemOutroSistema`, `adicionarItem` (gateway fake). ✅ 506 testes verdes na suíte `features/pcm`.
- Integração: pgTAP do índice único escrito, não executado local (sem Docker).
- Aceite: E2E escrito (task 10), não executado (sem credenciais de teste).

## Divergências (SPEC_DEVIATION)
- [x] Task 8 · a spec não previu o filtro "Todos/Equipamento/Componente" nem o badge por item em `EquipamentosPage`/`BoardAtivos`/`DrawerDetalheAtivo` (mostravam o `tipo` legado lado a lado com o novo nome "Componente" da entidade, criando colisão de rótulo). Resolução: renomeados para "Principal" (tipo='equipamento', item comum) e "Subcomponente (legado)" (tipo='componente', filho). Não requer atualizar spec — é rótulo de UI, não critério de aceite.

## Checklist de Definition of Done
- [x] AC-1..AC-5 verdes pelo gate (unidade/typecheck/lint; pgTAP e E2E escritos, aguardando CI/credenciais)
- [x] Migration aplicada em produção (task 2)
- [x] Glossário atualizado
- [x] ROADMAP (status) + `docs/STATE.md` atualizados
