---
name: tasks
description: Decomposição e gates — CRUD de Categorias de Produto e Equipamento.
alwaysApply: false
---

# Tasks — Categorias (Produto + Equipamento)

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S26_categorias.sql`: tabelas `pcm.produto_categorias` e `pcm.equipamento_categorias` (`id uuid`, `nome text not null`, `auvo_id bigint unique`, colunas de sync + auditoria, RLS FORCE módulo `pcm`), triggers `fn_auvo_enqueue('produto_categorias')`/`fn_auvo_enqueue('equipamento_categorias')` | AC-1, AC-3, AC-6 | E01-S22 mergeada | `supabase test db` | todo |
| 2  | Descriptors `registry/produto-categorias.ts` e `registry/equipamento-categorias.ts` (`auvoBasePath:'/productcategories'`/`'/equipmentcategories'`, `deleteStrategy:'hard-delete'` — ver E01-S25 task 1 para o campo no tipo, `cronSchedule` diário, `writeEnabled:false`) | AC-1, AC-2, AC-4 | 1, E01-S25 (campo `deleteStrategy`) | teste Deno dos descriptors | todo |
| 3  | Domínio/application/infrastructure/páginas — 2 slices (ou 1 slice com uma aba por tipo de categoria, decisão de implementação; se 1 slice, o domínio ainda modela as 2 entidades separadamente, só a UI compartilha layout) | AC-1, AC-2, AC-3, AC-5 | 2 | `vitest` | todo |
| 4  | Wiring em `HomePage.tsx`: item(ns) em CADASTROS | AC-5 | 3 | `pnpm run build` | todo |
| 5  | pgTAP `supabase/tests/categorias_rls.test.sql` | AC-6 | 1 | `supabase test db` | todo |
| 6  | Rodar `pnpm run ci:local` | todos | 1–5 | `pnpm run ci:local` | todo |
| 7  | Atualizar ROADMAP/STATE | — | 6 | revisão humana | todo |

## Plano de teste
- Unidade: domínio×2, use cases×2, descriptors×2.
- pgTAP: RLS das 2 tabelas.
- Aceite: os 6 AC (2x, uma por entidade).

## Divergências (SPEC_DEVIATION)
- [ ] (preencher durante a implementação se necessário)

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
