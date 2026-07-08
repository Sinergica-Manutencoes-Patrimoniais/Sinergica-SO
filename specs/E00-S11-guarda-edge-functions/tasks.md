---
name: tasks
description: Decomposição e gates — guarda-corpos de Edge Functions + saúde de sync.
alwaysApply: false
---

# Tasks — Guarda-corpos de Edge Functions + saúde de sync

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `scripts/check-edge-functions.mjs`: lê pastas de `supabase/functions/` (allowlist p/ `_shared`/`_template`/`_examples`), parse de `supabase/config.toml` (`[functions.*]`), grep de `functions.invoke("<literal>")` em `apps/web/src`; sai ≠0 se houver função órfã ou invoke sem função declarada | AC-1, AC-2 | — | `node scripts/check-edge-functions.mjs` (roda limpo no estado corrigido por E01-S35) | done |
| 2  | Ligar o gate no `ci:local` e no `lefthook` pre-push (mesmo ponto de `audit:esteira`) | AC-1, AC-2 | 1 | `pnpm run ci:local` | done |
| 3  | Migration `NNNN_E00-S11_auvo_sync_health.sql`: view `pcm.auvo_sync_health` (join outbox + tabelas de origem por entidade → `write_enabled`, `last_push_ok_at`, `last_pull_ok_at`, `last_error_at`, `last_error`), RLS/GRANT p/ papéis de leitura do PCM | AC-4 | — | `supabase test db` (pgTAP de RLS da view) | done |
| 4  | Ajustar `pcm-auvo-push` e os crons Auvo p/ registrar dry-run/secret-ausente como skip/erro explícito consumível pela view (não `sent`, não silêncio) | AC-3 | 3 | teste Deno de `processOutboxRow` (writeEnabled=false ⇒ marca skip explícito) | done |
| 5  | Badge/indicador de saúde de sync no header PCM lendo `pcm.auvo_sync_health` (adapter + componente) | AC-4 | 3 | test de componente/adapter | done |
| 6  | pgTAP `supabase/tests/auvo_sync_health_rls.test.sql` | AC-3, AC-4 | 3, 4 | `supabase test db` | done |
| 7  | `pnpm run ci:local` completo + atualizar ROADMAP/STATE | todos | 1–6 | `pnpm run ci:local` | done |

## Plano de teste
- Unidade (Node): `check-edge-functions.mjs` — fixtures com função órfã, invoke órfão, invoke dinâmico (ignorado).
- Integração (Deno): `pcm-auvo-push` marca skip explícito em `writeEnabled=false` (AC-3).
- pgTAP: RLS da view `pcm.auvo_sync_health` (só papéis autorizados leem).
- Aceite: 1 teste por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADRs de decisões difíceis de reverter registrados (n/a esperado)
- [ ] Glossário atualizado se mudou
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
