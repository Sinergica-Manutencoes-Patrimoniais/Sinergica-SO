---
name: tasks
description: Decomposição e gates — CRUD de Categorias de Produto e Equipamento.
alwaysApply: false
---

# Tasks — Categorias (Produto + Equipamento)

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0029_E01-S26_categorias.sql`: tabelas `pcm.produto_categorias` e `pcm.equipamento_categorias` (`id uuid`, `nome text not null`, `auvo_id bigint unique`, colunas de sync + auditoria, RLS FORCE módulo `pcm`), triggers `fn_auvo_enqueue('produto_categorias')`/`fn_auvo_enqueue('equipamento_categorias')` | AC-1, AC-3, AC-6 | E01-S22 mergeada | `supabase test db` | feito (migration; pgTAP não executado — sem Docker) |
| 2  | Descriptors em `registry/categorias.ts` (`auvoBasePath:'/productcategories'`/`'/equipmentcategories'`, `deleteStrategy:'hard-delete'`, `cronSchedule` diário, `writeEnabled:false`) + registro em `registry/index.ts` | AC-1, AC-2, AC-4 | 1, E01-S25 (campo `deleteStrategy`) | teste Deno dos descriptors | feito (código/teste; Deno não executado — sem Deno CLI) |
| 3  | Domínio/application/infrastructure/páginas — o slice compartilhado `catalogos-simples` foi estendido para `produto_categorias`/`equipamento_categorias`, preservando `nome` no banco e UI compartilhada | AC-1, AC-2, AC-3, AC-5 | 2 | `vitest` | feito |
| 4  | Wiring em `HomePage.tsx`: itens `Categorias Produto` e `Categorias Equip.` em CADASTROS | AC-5 | 3 | `pnpm run build` | feito |
| 5  | pgTAP `supabase/tests/categorias_rls.test.sql` | AC-6 | 1 | `supabase test db` | pendente (sem Docker local) |
| 6  | Rodar `pnpm run ci:local` | todos | 1–5 | `pnpm run ci:local` | feito parcialmente — `lint:migrations`, `lint`, `typecheck`, `test` (139 pass/9 skip), `build`, `arch:check` verdes; Deno/pgTAP/browser real pendentes |
| 7  | Atualizar ROADMAP/STATE | — | 6 | revisão humana | feito |

## Plano de teste
- Unidade: domínio×2, use cases×2, descriptors×2.
- pgTAP: RLS das 2 tabelas.
- Aceite: os 6 AC (2x, uma por entidade).

## Divergências (SPEC_DEVIATION)
- [ ] (preencher durante a implementação se necessário)

## Revisão adversarial (2026-07-07)
- **CORRIGIDO** — `pcm.produto_categorias.created_by`/`pcm.equipamento_categorias.created_by`
  estavam `not null` sem default (migration `0029`), mesmo gap de `E01-S24`/`E01-S25`: a RPC
  inbound (`fn_upsert_auvo_sync`) nunca preenche essa coluna. Retrofitado para nullable.
- Nota: estas 2 entidades têm `externalId` real no Auvo (diferente de `E01-S24`/`E01-S25`/
  `E01-S27` grupos), então a lacuna de "match-by-description" não se aplica aqui.

## Checklist de Definition of Done
- [x] AC-1 a AC-6 implementados em código local
- [ ] Todos os AC verdes pelo gate executável completo (Deno/pgTAP/browser)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde completo; localmente ficaram verdes os gates Node listados na task 6,
      mas Deno/pgTAP e teste manual com dado reversível ainda precisam rodar no ambiente adequado
