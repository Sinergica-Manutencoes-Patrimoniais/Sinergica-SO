---
name: tasks
description: Decomposição e gates — motor de sync Auvo (write path).
alwaysApply: false
---

# Tasks — Motor de sync Auvo (write path)

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Registrar `docs/adr/0005-outbox-sync-auvo.md` (decisão difícil de reverter: outbox como mecanismo único de propagação PCM→Auvo) | — | — | revisão humana (Lucas) | feito |
| 2  | `auvoPatch`/`auvoDelete` em `supabase/functions/_shared/auvo/client.ts` + testes Deno (`client.test.ts`, mock de `fetch`, mesmo padrão de retry 401/429 dos métodos existentes) | AC-3, AC-4 | — | `deno test supabase/functions/_shared/auvo/` | feito (código; gate Deno não executado — sem Deno CLI neste ambiente) |
| 3  | Migration `0024_E01-S22_auvo_sync_outbox.sql`: tabela `pcm.auvo_sync_outbox` (colunas do `design.md` → Contrato da tabela outbox, índice `(status, enqueued_at)`), RLS FORCE + GRANT só `service_role`, função `pcm.fn_auvo_enqueue()` (trigger genérica por `TG_ARGV[0]`, checa o GUC `app.auvo_sync_write`) + `pcm.fn_apply_auvo_sync(p_table, p_row_id, p_patch)` (RPC `security definer` que seta o GUC e aplica o patch) + `pcm.fn_claim_auvo_outbox_batch(p_limit)` (RPC de reivindicação atômica, adicionada durante a implementação — ver Divergências) | AC-1, AC-2, AC-7 | 1 | `supabase test db` (pgTAP novo: `auvo_sync_outbox_rls.test.sql`) | feito (código; `lint:migrations` verde; `supabase test db` não executado — sem Docker neste ambiente) |
| 4  | pgTAP `supabase/tests/auvo_sync_outbox_rls.test.sql`: RLS FORCE, sem policy para `authenticated` (nem SELECT), `fn_auvo_enqueue` enfileira em INSERT/UPDATE/soft-DELETE genuínos e NÃO enfileira quando a escrita passa por `fn_apply_auvo_sync`, mais `fn_claim_auvo_outbox_batch` (reivindica uma vez só) — tabela dummy `pcm._test_auvo_enqueue` criada e limpa pelo próprio `rollback` da transação do teste | AC-1, AC-2, AC-3, AC-7 | 3 | `supabase test db` | feito (código, 12 assertions; execução real pendente de CI `db-tests`/Docker) |
| 5  | `supabase/functions/_shared/auvo/registry/types.ts` (interface `AuvoEntityDescriptor<TAuvo,TRow>`) + `.../registry/index.ts` (`Record` vazio + `getDescriptor(entity)` retornando `undefined` se não achar, sem lançar) + teste Deno | — (infra p/ AC-3, AC-6) | 2 | `deno test supabase/functions/_shared/auvo/registry/` | feito (código; gate Deno não executado) |
| 6  | Edge Function `supabase/functions/pcm-auvo-push/index.ts`: `requireServiceRole`, reivindica lote via `fn_claim_auvo_outbox_batch`, resolve descriptor via registry, chama Auvo conforme `op`/`writeEnabled`, grava `auvo_id`/status na linha de origem via RPC `pcm.fn_apply_auvo_sync`, marca outbox `sent`/`error`, nunca lança para o chamador (try/catch por linha, mesmo padrão de `pcm-auvo-customers-import`). Lógica de decisão isolada em `processOutboxRow` (testável sem cliente Supabase real, via a porta `OutboxRowDb`) | AC-3, AC-4, AC-5, AC-6 | 3, 5 | teste de integração Deno (mock HTTP Auvo): idempotência, retry-não-trava-lote, `writeEnabled=false` não chama `fetch` | feito (código, 8 testes cobrindo create/update/delete/idempotência/writeEnabled/descriptor ausente/origem ausente; gate Deno não executado) |
| 7  | Migration `0025_E01-S22_cron_drain_outbox.sql`: `pg_cron` `pcm_auvo_push_drain` a cada 1 min, reusa secrets do Vault de `0011`/`0013` (sem secret novo), `security definer`, no-op com `raise warning` se secrets ausentes (mesmo padrão de `0013`) | AC-3 (agendamento) | 6 | `lint:migrations` (Squawk + `scripts/lint-migrations.mjs`) | feito (`lint:migrations` verde: 27 migrations) |
| 8  | Rodar `pnpm run ci:local` completo + `supabase test db` (se Docker disponível) e corrigir o que quebrar | todos | 1–7 | `pnpm run ci:local` | feito parcialmente — `lint:migrations`, `lint`, `typecheck`, `test` (126 pass/9 skip), `build`, `audit:esteira`, `eval:spec`, `arch:check` todos verdes neste ambiente. **Gaps conhecidos, mesma ressalva de toda a integração Auvo desde E01-S09**: sem Deno CLI aqui, `client.test.ts`/`registry/index.test.ts`/`pcm-auvo-push/index.test.ts` não foram executados; sem Docker, `supabase test db` (pgTAP `auvo_sync_outbox_rls.test.sql`) não foi executado — ambos ficam para o CI (`db-tests`) antes do merge |
| 9  | Atualizar `docs/epics/ROADMAP.md` (status ✅, owner, link da spec) e `docs/STATE.md` (handoff) | — | 8 | revisão humana | feito |

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
- [x] Task 3 · o design/spec/ADR originais previam um `updated_by` sentinela (`auvo_system_user_id`)
      para o anti-loop. Descoberto durante a implementação que `updated_by` tem
      `references auth.users` (`0001_E00-S00`) — um sentinela exigiria uma linha falsa na tabela
      gerenciada pelo Supabase Auth, frágil entre versões. Resolução: **atualizei
      `design.md`/`domain.md`/`spec.md`/ADR-0005 antes de codar** (não silencioso) para usar um GUC
      transacional (`app.auvo_sync_write`) + RPC `fn_apply_auvo_sync`, mecanismo já citado como
      alternativa no design original. Spec e código estão consistentes com a decisão final.
- [x] Task 3/6 · o design original descrevia a reivindicação de lote como um `SELECT ... FOR UPDATE
      SKIP LOCKED` genérico, sem detalhar como isso atravessaria o PostgREST (que não expõe
      `FOR UPDATE` a um `SELECT` solto do cliente). Resolução: adicionado o estado `'processing'` ao
      `CHECK` de `status` e a RPC `fn_claim_auvo_outbox_batch`, que faz o `UPDATE ... FOR UPDATE SKIP
      LOCKED ... RETURNING` inteiro dentro de uma única função `security definer`. Documentado em
      `design.md` → Componentes/Riscos antes de escrever a migration.

## Revisão adversarial (2026-07-07)
- **Follow-up não corrigido (médio)** — em `pcm-auvo-push/index.ts` (`processOutboxRow`), se o
  `POST`/`PATCH` no Auvo tiver sucesso mas o `fn_apply_auvo_sync` subsequente (grava `auvo_id`/
  status na linha de origem) falhar por qualquer motivo, a linha da outbox vira `status='error'` sem
  o `externalId` ter sido persistido localmente. `fn_claim_auvo_outbox_batch` só reivindica
  `status='pending'`, então essa linha não é reprocessada automaticamente — mas se um operador
  resetar manualmente para `pending`, `existingAuvoId` continua `null` e um segundo `POST` é
  disparado, podendo duplicar o recurso no Auvo (a deduplicação por `externalId` do lado do Auvo não
  é verificada, ver nota no topo de `client.ts`). Mitigação futura: persistir o `externalId`
  retornado ANTES de considerar a linha bem-sucedida, ou separar os dois passos numa transação única
  via RPC (hoje são 2 chamadas independentes: HTTP externo + RPC local, não podem ser atômicas por
  natureza — mas o "gravar o id assim que a Auvo responder, mesmo que o resto falhe" é possível).
- Achados C2/C3/C4 relacionados ao contrato deste motor genérico (anti-loop nas Edge Functions
  legadas, bug de array em `fn_upsert_auvo_sync`, `created_by NOT NULL` sem default) foram
  corrigidos nos arquivos de `E01-S23`/`E01-S24`-`S27`/`E01-S32` — o design/contrato deste story
  (outbox, `fn_apply_auvo_sync`, GUC anti-loop) em si estava correto; o gap era código que não o
  adotou.

## Checklist de Definition of Done
- [x] Todos os AC (AC-1 a AC-7) implementados — gate executável real (`supabase test db`/Deno)
      pendente do CI, ver task 8
- [x] Nenhum `SPEC_DEVIATION` pendente — as 2 divergências acima foram resolvidas atualizando a
      spec/design/ADR antes de codar, não deixadas em aberto
- [x] ADR-0005 registrado (task 1)
- [ ] Glossário — nenhum termo desta story (outbox, descriptor, GUC de sync) é vocabulário de
      negócio visível ao Fabrício; decisão consciente de não promover a `docs/glossary.md`
      (é vocabulário técnico interno do motor, análogo a "Porta Auvo" de E01-S09 que também não
      foi promovida)
- [x] Spec reflete o que foi construído (atualizada durante a implementação, ver Divergências acima)
- [x] `docs/STATE.md` e `docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde neste ambiente (lint/typecheck/test/build/esteira/eval/arch); `db-tests`
      (Docker/CI) e os 3 arquivos `*.test.ts` Deno **ainda não confirmados** — sem Deno CLI/Docker
      neste ambiente, mesma ressalva de toda a integração Auvo desde E01-S09. Bloqueante para
      considerar a story 100% fechada; não bloqueante para abrir o PR (mesmo padrão das stories
      anteriores)
