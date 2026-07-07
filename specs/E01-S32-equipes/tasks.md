---
name: tasks
description: Decomposição e gates — CRUD de Equipes (criação propaga; edição/exclusão só locais).
alwaysApply: false
---

# Tasks — Equipes

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S32_equipes.sql`: tabela `pcm.equipes` (`id uuid`, `nome text not null`, `participantes_auvo_ids bigint[]`, `gestores_auvo_ids bigint[]`, `auvo_id bigint unique`, colunas de sync + auditoria), RLS FORCE módulo `pcm`, trigger `fn_auvo_enqueue('equipes')` | AC-1, AC-2, AC-3, AC-5 | E01-S22, E01-S28 mergeadas | `supabase test db` | todo |
| 2  | Descriptor `registry/equipes.ts` (`auvoBasePath:'/teams'`, `supportsUpdate:false`, `deleteStrategy:'unsupported'`, `cronSchedule:'0 */6 * * *'`, `writeEnabled:false`, `toAuvo` mapeia `participantes_auvo_ids→participants`/`gestores_auvo_ids→managers`) | AC-1, AC-4 | 1 | teste Deno do descriptor | todo |
| 3  | Domínio/application/infrastructure: seletor de técnicos por `auvo_user_id` (reaproveitar `pcm.funcionarios`/`tecnicos_cache`), adapter/use cases seguindo o padrão de `E01-S24` | AC-1, AC-5 | 2 | `vitest` | todo |
| 4  | `pages/EquipesPage.tsx` com o aviso permanente de AC-2/AC-3 visível sempre que o usuário tenta editar/excluir uma Equipe já sincronizada | AC-2, AC-3, AC-5 | 3 | teste manual em browser | todo |
| 5  | Wiring em `HomePage.tsx`: item "Equipes" em CADASTROS | AC-5 | 4 | `pnpm run build` | todo |
| 6  | pgTAP `supabase/tests/equipes_rls.test.sql` | AC-5 | 1 | `supabase test db` | todo |
| 7  | Rodar `pnpm run ci:local` | todos | 1–6 | `pnpm run ci:local` | todo |
| 8  | Atualizar ROADMAP/STATE | — | 7 | revisão humana | todo |

## Plano de teste
- Unidade: domínio, descriptor (mapeamento de participantes/gestores).
- pgTAP: RLS.
- Manual: confirmar que o aviso de "não propaga" aparece ao tentar editar/excluir.
- Aceite: os 5 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] `Teams` sem `PATCH`/`DELETE` — resolvido em `E01-S22` (`supportsUpdate`/`deleteStrategy:
      'unsupported'`, já implementados e testados antes desta story existir).

## Checklist de Definition of Done
- [ ] Todos os AC (AC-1 a AC-5) verdes pelo gate executável
- [ ] Aviso de "não propaga" visível e testado manualmente
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
