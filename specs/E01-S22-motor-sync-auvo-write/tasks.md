---
name: tasks
description: Decomposição e gates — motor de sync Auvo (write path).
alwaysApply: false
---

# Tasks — Motor de sync Auvo (write path)

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Registrar `docs/adr/0005-outbox-sync-auvo.md` (decisão difícil de reverter: outbox como mecanismo único de propagação PCM→Auvo) | — | — | revisão humana (Lucas) | todo |
| 2  | `auvoPatch`/`auvoDelete` em `supabase/functions/_shared/auvo/client.ts` + testes Deno (`client.test.ts`, mock de `fetch`, mesmo padrão de retry 401/429 dos métodos existentes) | AC-3, AC-4 | — | `deno test supabase/functions/_shared/auvo/` | todo |
| 3  | Migration `0024_E01-S22_auvo_sync_outbox.sql`: tabela `pcm.auvo_sync_outbox` (colunas do `design.md` → Contrato da tabela outbox, índice `(status, enqueued_at)`), RLS FORCE + GRANT só `service_role`, função `pcm.fn_auvo_enqueue()` (trigger genérica por `TG_ARGV[0]`, checa o GUC `app.auvo_sync_write`) + `pcm.fn_apply_auvo_sync(p_table, p_row_id, p_patch)` (RPC `security definer` que seta o GUC e aplica o patch — ver `domain.md`) | AC-1, AC-2, AC-7 | 1 | `supabase test db` (pgTAP novo: `auvo_sync_outbox_rls.test.sql`) | todo |
| 4  | pgTAP `supabase/tests/auvo_sync_outbox_rls.test.sql`: RLS FORCE, sem policy para `authenticated` (nem SELECT), `fn_auvo_enqueue` enfileira em INSERT/UPDATE/soft-DELETE genuínos e NÃO enfileira quando a escrita passa por `fn_apply_auvo_sync` (usar uma tabela de teste ou a primeira tabela real que `E01-S24` for registrar — decidir na implementação; se nenhuma tabela real existir ainda, criar uma tabela dummy só para o teste, dropada no mesmo arquivo) | AC-1, AC-2, AC-7 | 3 | `supabase test db` | todo |
| 5  | `supabase/functions/_shared/auvo/registry/types.ts` (interface `AuvoEntityDescriptor<TAuvo,TRow>`) + `.../registry/index.ts` (`Record` vazio + `getDescriptor(entity)` retornando `undefined` se não achar, sem lançar) + teste Deno | — (infra p/ AC-3, AC-6) | 2 | `deno test supabase/functions/_shared/auvo/registry/` | todo |
| 6  | Edge Function `supabase/functions/pcm-auvo-push/index.ts`: `requireServiceRole`, reivindica lote `pending` (`FOR UPDATE SKIP LOCKED`, `LIMIT` configurável — proposta 20), resolve descriptor via registry, chama Auvo conforme `op`/`writeEnabled`, grava `auvo_id`/status na linha de origem via RPC `pcm.fn_apply_auvo_sync`, marca outbox `sent`/`error`, nunca lança para o chamador (try/catch por linha, mesmo padrão de `pcm-auvo-customers-import`) | AC-3, AC-4, AC-5, AC-6 | 3, 5 | teste de integração Deno (mock HTTP Auvo): idempotência, retry-não-trava-lote, `writeEnabled=false` não chama `fetch` | todo |
| 7  | Migration `0025_E01-S22_cron_drain_outbox.sql`: `pg_cron` `pcm_auvo_push_drain` a cada 1 min, reusa secrets do Vault de `0011`/`0013` (sem secret novo), `security definer`, no-op com `raise warning` se secrets ausentes (mesmo padrão de `0013`) | AC-3 (agendamento) | 6 | `lint:migrations` (Squawk + `scripts/lint-migrations.mjs`) | todo |
| 8  | Rodar `pnpm run ci:local` completo + `supabase test db` (se Docker disponível) e corrigir o que quebrar | todos | 1–7 | `pnpm run ci:local` | todo |
| 9  | Atualizar `docs/epics/ROADMAP.md` (status ✅, owner, link da spec) e `docs/STATE.md` (handoff) | — | 8 | revisão humana | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual. Tasks 2, 5 são
> `[P]` entre si (sem dependência mútua, ambas só dependem do estado atual do repo).

## Plano de teste
- Unidade (Deno): `client.ts` (`auvoPatch`/`auvoDelete`, mock de `fetch`), `registry/index.ts`
  (`getDescriptor` com chave existente/inexistente).
- Integração (Deno, mock HTTP Auvo): `pcm-auvo-push` — idempotência (mesma linha 2x ⇒ 1 create +
  1 update), retry não trava lote (1 linha falha, as outras continuam), `writeEnabled=false`
  nunca chama `fetch`, linha de origem some entre enqueue/drain não lança exceção.
- pgTAP: RLS FORCE da outbox (zero acesso de `authenticated`), `fn_auvo_enqueue` enfileira/não
  enfileira conforme o GUC `app.auvo_sync_write`.
- Aceite: os 7 AC de `spec.md`, um teste cada (unidade+integração+pgTAP cobrem todos; nenhum
  precisa de E2E de browser, é motor de infraestrutura sem UI).

## Divergências (SPEC_DEVIATION)
> Se a implementação precisar fugir da spec, registrar aqui antes de seguir.
- [ ] (nenhuma até o momento — preencher durante a implementação se necessário)

## Checklist de Definition of Done
- [ ] Todos os AC (AC-1 a AC-7) verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR-0005 registrado (task 1)
- [ ] Glossário atualizado se algum termo do `domain.md` for promovido (`docs/glossary.md`)
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` e `docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde; `db-tests` (Docker/CI) confirmado para o pgTAP novo
