---
name: tasks
description: Decomposição e gates — motor de sync Auvo (read path).
alwaysApply: false
---

# Tasks — Motor de sync Auvo (read path)

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `registry/index.ts`: adicionar `byWebhookEntity(entity: number)` (filtra por `descriptor.webhookEntity === entity`, devolve `undefined` se nenhum) e `cronEnabled()` (lista descriptors com `cronSchedule` definido) + testes | AC-1, AC-3, AC-5 | E01-S22 mergeada | `deno test supabase/functions/_shared/auvo/registry/` | feito (código/teste; Deno não executado — sem Deno CLI neste ambiente) |
| 2  | Extrair a lógica de decisão do dispatcher para uma função pura testável (`_shared/auvo/webhook-dispatch.ts` → `resolveWebhookDispatch(evento, descriptor)`, com ações `upsert`/`soft-delete`/`ignore`), isolada do `serve()` do jeito que `pcm-auvo-push` isolou `processOutboxRow` | AC-1, AC-2, AC-3, AC-4 | 1 | teste Deno da função pura | feito (código/teste; Deno não executado) |
| 3  | Editar `supabase/functions/pcm-auvo-webhook/index.ts`: antes do bloco legado de `Task`, tentar `byWebhookEntity(evento.entity)`; se achar descriptor, chamar a função de task 2 e aplicar via `fn_upsert_auvo_sync`; **handler de Task existente preservado como caminho separado** (AC-4) | AC-1, AC-2, AC-3, AC-4 | 2 | teste Deno de regressão: evento `entity=Task` produz o mesmo resultado de antes | feito (código; regressão Deno pendente) |
| 4  | Edge Function `supabase/functions/pcm-auvo-pull/index.ts`: recebe `{ entity }`, resolve descriptor, pagina via `auvoPaginate` (reusa `_shared/auvo/paginate.ts`), mapeia com `fromAuvo`, upsert por `auvo_id` via `fn_upsert_auvo_sync`, guarda de soft-delete em resultado vazio e reconcilia sumidos via `fn_soft_delete_missing_auvo_sync` | AC-5, AC-6 | 1 | teste de integração Deno (mock HTTP Auvo): paginação completa, guarda de vazio, erro no meio propaga sem escrita parcial | feito (código; teste Deno pendente) |
| 5  | Edge Function one-shot `supabase/functions/pcm-auvo-webhooks-register/index.ts`: itera `registry` filtrando `webhookEntity` definido, consulta `GET /webhooks` quando disponível para evitar duplicata e faz `POST /webhooks` com `targetUrl` = `<SUPABASE_URL>/functions/v1/pcm-auvo-webhook` quando necessário | AC-7 | 1 | teste de integração Deno (mock HTTP Auvo): 2 invocações seguidas não geram erro nem duplicam a chamada de registro por entidade | feito (código; teste Deno pendente) |
| 6  | Rodar `pnpm run ci:local` + `supabase test db` (se Docker disponível) | todos | 1–5 | `pnpm run ci:local` | feito parcialmente — `lint:migrations`, `lint`, `typecheck`, `test` (126 pass/9 skip), `build`, `audit:esteira`, `eval:spec`, `arch:check` verdes; Deno e Docker ausentes, então testes Deno/pgTAP não executados |
| 7  | Atualizar `docs/epics/ROADMAP.md` e `docs/STATE.md` | — | 6 | revisão humana | feito |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: `registry.byWebhookEntity`/`cronEnabled`; a função pura de decisão do dispatcher
  (task 2) cobrindo os 4 casos (upsert Inclusão, upsert Alteração, soft-delete Exclusão, ignorado
  por descriptor ausente/writeEnabled=false).
- Regressão: um evento `entity=Task` real (fixture do payload já usado nos testes de `E01-S10`/
  `E01-S15`, se existirem) produz status/snapshot/vínculo de equipamento idênticos ao
  comportamento pré-`E01-S23` — prova que o dispatcher novo não regride o caminho existente.
- Integração (mock HTTP Auvo): `pcm-auvo-pull` (paginação completa, guarda de vazio, erro no meio
  não escreve nada), `pcm-auvo-webhooks-register` (idempotência).
- Aceite: os 7 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] Task 3/4 · a spec original dizia aplicar inbound via `fn_apply_auvo_sync`, mas essa RPC só
      atualiza por `id` local e não cria linha nova por `auvo_id`. Para cumprir AC-1/AC-5 de
      verdade (upsert Auvo→PCM), foi criada a migration
      `0026_E01-S23_auvo_sync_upsert_rpc.sql` com `fn_upsert_auvo_sync(p_table,p_auvo_id,p_patch)`
      e `fn_soft_delete_missing_auvo_sync(...)`, ambas setando o mesmo GUC
      `app.auvo_sync_write=true` para manter o anti-loop.

## Revisão adversarial (2026-07-07)
- **CORRIGIDO** — `pcm.fn_upsert_auvo_sync` (migration `0026`) montava o `SET`/`INSERT` via
  `jsonb_each_text` + `%L`, que para uma coluna array produz a sintaxe JSON (`[1,2]`) em vez da
  sintaxe de array do Postgres (`{1,2}`) — `malformed array literal` em qualquer patch com coluna
  array (ex.: `equipes.participantes_auvo_ids`, ver `E01-S32`). Corrigido para converter arrays via
  `jsonb_array_elements_text` antes de virar literal; escalares seguem via `#>>'{}'` (equivalente ao
  comportamento anterior). Confirmado que `pcm-auvo-pull` NÃO deve ganhar gate de `writeEnabled`
  (ver `E01-S30`: é intencional que o poller rode independente do kill switch de escrita).
- **CORRIGIDO** — `pcm-auvo-customers-sync`, `pcm-auvo-customers-import`, `pcm-auvo-users-sync` e
  `pcm-auvo-equipment-sync` (Edge Functions legadas de `E01-S09`/`E01-S11`/`E01-S13`, ainda ativas
  via `pg_cron`) gravavam direto em `pcm.clientes`/`funcionarios`/`equipamentos` via PostgREST
  comum, sem passar por `fn_upsert_auvo_sync`/`fn_apply_auvo_sync` — sem setar
  `app.auvo_sync_write`, cada escrita delas disparava `fn_auvo_enqueue()` e enfileirava um eco na
  outbox. Inofensivo enquanto `writeEnabled:false`, mas geraria PATCH de eco pro Auvo assim que
  ligado. As 4 funções foram atualizadas para usar as RPCs anti-loop (achado C2 da revisão).

## Checklist de Definition of Done
- [x] AC-1 a AC-7 implementados em código
- [ ] Todos os AC (AC-1 a AC-7) verdes pelo gate executável Deno/pgTAP/CI
- [ ] AC-4 confirmado por teste de regressão explícito (não só ausência de erro — comparar o
      resultado exato antes/depois da mudança)
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] `docs/STATE.md` e `docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde completo; localmente ficaram verdes os comandos Node listados na
      task 6, mas `db-tests` (Docker/CI) e os testes Deno ainda precisam rodar no CI antes do merge
