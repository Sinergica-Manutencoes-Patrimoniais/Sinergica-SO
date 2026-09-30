---
name: tasks-E01-S156
description: Tasks da E01-S156 — siglas.ts, sigla no catálogo, categoria_id em equipamentos/sistemas, seeds, backfill sem PATCH, SeletorCategoria.
alwaysApply: false
---

# Tasks — E01-S156 Categoria de ativo como catálogo

> Commits: `feat(E01-S156): ...`. Paths web relativos a `apps/web/src/`.
> Leia `design.md` → "Algoritmo de sigla", "Regra de ouro", "Ordem dos triggers".

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Domínio `features/pcm/domain/siglas.ts`** (puro, sem I/O): `sugerirSigla`, `sugerirSiglaUnica`, `validarSigla`, exatamente como no design (passos 1–5, regra b com **exatamente 1 palavra**, alfabeto de desempate `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`). `siglas.test.ts` com **todas** as linhas da tabela "Casos de ouro" como `it.each`, mais os casos do AC-1. | AC-1 | — | `vitest run src/features/pcm/domain/siglas.test.ts` | todo |
| 2 | **Migration A** `NNNN_E01-S156_categoria_ativo_catalogo.sql`: (a) `sigla` + check + índice único em `pcm.equipamento_categorias`; (b) `categoria_id uuid` em `pcm.equipamentos` e `pcm.sistemas` + FKs `not valid` + índices; (c) `categoria text` em `pcm.sistemas`; (d) funções/triggers `trg_equipamentos_categoria_sync` e `trg_sistemas_categoria_sync` (AC-4, passos 1–3); (e) seeds do AC-3 com `insert ... select ... where not exists (select 1 from pcm.equipamento_categorias where lower(nome) = lower(<nome>) and deleted_at is null)` e `update ... set sigla = <sigla> where lower(nome) = lower(<nome>) and sigla is null` (update em linha de catálogo pode enfileirar PATCH da categoria com o mesmo payload; são no máximo 6 linhas, aceito); (f) **backfill** em bloco próprio: `set local app.auvo_sync_write = 'true'; update pcm.equipamentos e set categoria_id = c.id from pcm.equipamento_categorias c where e.categoria_id is null and e.categoria is not null and lower(c.nome) = lower(e.categoria) and c.deleted_at is null;` Confirme antes em `0051` que o flag suprime o enqueue (já confirmado no design; releia mesmo assim). | AC-2, AC-3, AC-4, AC-5 | — | `supabase db lint` | todo |
| 3 | **Migration B** `NNNN_E01-S156_validar_fk_categoria.sql`: `validate constraint` das 2 FKs. | AC-4 | 2 | `supabase test db` | todo |
| 4 | **pgTAP** `supabase/tests/pcm_categoria_ativo.test.sql`: coluna/check/índice de sigla; 6 seeds com sigla; trigger passos 1, 2 e 3 (inclusive o 3 com `set local app.auvo_sync_write='true'` simulando inbound); backfill sem linha nova no outbox (conte `pcm.auvo_sync_outbox` antes/depois de um update com o flag). | AC-2, AC-3, AC-4, AC-5 | 2 | `supabase test db` | todo |
| 5 | **Descriptor sistemas** (`supabase/functions/_shared/auvo/registry/sistemas.ts`): `SistemaRow` ganha `categoria?: string \| null`, `toAuvo` envia `category: row.categoria`, `AuvoEquipmentSistema` ganha `category?: string`. Atualize `sistemas.test.ts` (Deno). Depois do merge, redeploy de `pcm-auvo-push`, `pcm-auvo-pull`, `pcm-auvo-sync-all`, `pcm-auvo-webhook`, `pcm-auvo-webhooks-register` (todas importam o registry). Smoke: chamada sem auth → 401, nunca 500. | AC-4 | 2 | `deno test supabase/functions/_shared/auvo/registry/sistemas.test.ts` (CI) | todo |
| 6 | **Domínio**: `EquipamentoItem`/`EquipamentoFormData` ganham `categoriaId`. `Sistema`/`SistemaFormData` ganham `categoriaId` e `categoria`. `validarEquipamento` e `validarSistema` exigem `categoriaId` ("Categoria é obrigatória."). `catalogos-simples.ts`: `CatalogoSimplesItem` ganha `sigla: string \| null`, `rotuloCatalogoSimples('equipamento_categorias')` → "Categorias de Ativo". Ajuste testes. | AC-6, AC-8 | 1 | `vitest run src/features/pcm/domain` | todo |
| 7 | **Adapters**: equipamentos e sistemas leem/gravam `categoria_id` (e `categoria` só para leitura). `supabase-catalogos-simples-adapter.ts`: `CATEGORY_COLS` inclui `sigla`; `criar`/`editar` gravam `sigla` quando `tipo === 'equipamento_categorias'`; erro `23505` com `uq_equipamento_categorias_sigla` → `Error("Sigla já usada por outra categoria.")`. | AC-6, AC-7, AC-8 | 2, 6 | typecheck | todo |
| 8 | **Query hooks**: em `application/ativos-cliente-queries.ts` (criado na S155; se ainda não existir, crie com o mesmo padrão), adicione `ativosClienteQueryKeys.categorias = () => ['pcm','ativos','categorias']` e `useCategoriasAtivo()` (lista ativas, ordenada por nome) + `useCriarCategoriaAtivo()` (mutation que invalida `categorias`). | AC-6, AC-7 | 7 | typecheck | todo |
| 9 | **UI** novo `components/SeletorCategoria.tsx` (`value: string \| null`, `onChange(id)`, `textoLegado?: string \| null`): select + aviso de legado (AC-6) + "+ Nova categoria" com mini-form (AC-7). Use nos modais: `EquipamentoModal.tsx` (substitui o `Field` "Categoria") e `SistemaModal` em `SistemasPage.tsx` (substitui o campo "Tipo"). Teste `SeletorCategoria.test.tsx`: legado mostra aviso; criar nova seleciona. | AC-6, AC-7 | 8 | `vitest run src/features/pcm/components/SeletorCategoria.test.tsx` | todo |
| 10 | **Tela de catálogo**: `CatalogoSimplesPage.tsx`, só para `equipamento_categorias`: coluna e campo Sigla com sugestão. | AC-8 | 7 | typecheck + `pnpm run ci:local` | todo |
| 11 | **Glossário**: entrada **Categoria de ativo** ("Classificação obrigatória de Componente e Sistema, do catálogo `pcm.equipamento_categorias`, espelhado com as categorias de Equipment do Auvo. Tem Sigla.") e **Sigla** ("Código de exatamente 3 caracteres `[A-Z0-9]` de Cliente, Área, Local ou Categoria, usado no Identificador (ADR-0022).") | AC-2 | — | `pnpm run audit:esteira` | todo |

## Plano de teste
- Unidade: `siglas.ts` (casos de ouro), validações, `SeletorCategoria`.
- Banco: pgTAP (task 4). Deno: descriptor de sistemas.
- Aceite: manual/E2E: criar Componente escolhendo "Elétrica (ELE)" e conferir `categoria` = "Elétrica".

## Divergências (SPEC_DEVIATION)
- [ ] (vazio)

## Checklist de Definition of Done
- [ ] AC-1..AC-8 verdes · `ci:local` · CI `db-tests` e Deno verdes
- [ ] Migrations em produção · outbox conferido (6 creates de categoria, **nenhum** update em massa de equipamentos)
- [ ] Edge Functions redeployadas (task 5)
- [ ] Glossário · ROADMAP · STATE
