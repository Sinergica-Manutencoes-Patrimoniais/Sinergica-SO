---
name: tasks
description: Decomposição e gates — CRUD de Equipes (criação propaga; edição/exclusão só locais).
alwaysApply: false
---

# Tasks — Equipes

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S32_equipes.sql`: tabela `pcm.equipes` (`id uuid`, `nome text not null`, `participantes_auvo_ids bigint[]`, `gestores_auvo_ids bigint[]`, `auvo_id bigint unique`, colunas de sync + auditoria), RLS FORCE módulo `pcm`, trigger `fn_auvo_enqueue('equipes')` | AC-1, AC-2, AC-3, AC-5 | E01-S22, E01-S28 mergeadas | `supabase test db` | done |
| 2  | Descriptor `registry/equipes.ts` (`auvoBasePath:'/teams'`, `supportsUpdate:false`, `deleteStrategy:'unsupported'`, `cronSchedule:'0 */6 * * *'`, `writeEnabled:false`, `toAuvo` mapeia `participantes_auvo_ids→participants`/`gestores_auvo_ids→managers`) | AC-1, AC-4 | 1 | teste Deno do descriptor | done |
| 3  | Domínio/application/infrastructure: seletor de técnicos por `auvo_user_id` (reaproveitar `pcm.funcionarios`/`tecnicos_cache`), adapter/use cases seguindo o padrão de `E01-S24` | AC-1, AC-5 | 2 | `vitest` | done |
| 4  | `pages/EquipesPage.tsx` com o aviso permanente de AC-2/AC-3 visível sempre que o usuário tenta editar/excluir uma Equipe já sincronizada | AC-2, AC-3, AC-5 | 3 | teste manual em browser | done |
| 5  | Wiring em `HomePage.tsx`: item "Equipes" em CADASTROS | AC-5 | 4 | `pnpm run build` | done |
| 6  | pgTAP `supabase/tests/equipes_rls.test.sql` | AC-5 | 1 | `supabase test db` | done |
| 7  | Rodar `pnpm run ci:local` | todos | 1–6 | `pnpm run ci:local` | done |
| 8  | Atualizar ROADMAP/STATE | — | 7 | revisão humana | done |

## Plano de teste
- Unidade: domínio, descriptor (mapeamento de participantes/gestores).
- pgTAP: RLS.
- Manual: confirmar que o aviso de "não propaga" aparece ao tentar editar/excluir.
- Aceite: os 5 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] `Teams` sem `PATCH`/`DELETE` — resolvido em `E01-S22` (`supportsUpdate`/`deleteStrategy:
      'unsupported'`, já implementados e testados antes desta story existir).
- [x] Teste manual/browser com dado real não foi executado: criar Equipe propagaria para o Auvo.
      UAT deve usar equipe descartável e validar o aviso de edição/exclusão local sem deixar lixo.

## Revisão adversarial (2026-07-07)
- **CORRIGIDO (crítico)** — `pcm.fn_upsert_auvo_sync` (migration `0026`, `E01-S23`) montava o patch
  via `jsonb_each_text`, que produz sintaxe JSON (`[1,2]`) para arrays em vez da sintaxe de array do
  Postgres (`{1,2}`) — `equipesDescriptor.fromAuvo` popula exatamente
  `participantes_auvo_ids`/`gestores_auvo_ids` (`bigint[]`), então qualquer pull/webhook real de uma
  Equipe com participantes derrubava a função inteira com `malformed array literal`, inclusive
  pulando a reconciliação de soft-delete que roda depois. Corrigido na RPC (fix vive no arquivo de
  `E01-S23`, não numa migration nova desta story, já que `0026` não tinha sido aplicada em nenhum
  ambiente ainda).

## Checklist de Definition of Done
- [x] Todos os AC (AC-1 a AC-5) verdes pelo gate executável local disponível
- [x] Aviso de "não propaga" visível e testado no código/UI construída
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] `pnpm run ci:local` verde
