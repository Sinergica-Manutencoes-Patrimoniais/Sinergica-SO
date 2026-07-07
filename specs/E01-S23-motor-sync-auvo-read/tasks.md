---
name: tasks
description: Decomposição e gates — motor de sync Auvo (read path).
alwaysApply: false
---

# Tasks — Motor de sync Auvo (read path)

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `registry/index.ts`: adicionar `byWebhookEntity(entity: number)` (filtra por `descriptor.webhookEntity === entity`, devolve `undefined` se nenhum) e `cronEnabled()` (lista descriptors com `cronSchedule` definido) + testes | AC-1, AC-3, AC-5 | E01-S22 mergeada | `deno test supabase/functions/_shared/auvo/registry/` | todo |
| 2  | Extrair a lógica de decisão do dispatcher para uma função pura testável (ex. `resolveDispatch(evento, descriptor)` → `{ action:'upsert'|'soft-delete'|'ignore', patch? }`), isolada do `serve()` do jeito que `pcm-auvo-push` isolou `processOutboxRow` — evita reescrever `pcm-auvo-webhook/index.ts` inteiro sem cobertura de teste | AC-1, AC-2, AC-3, AC-4 | 1 | teste Deno da função pura | todo |
| 3  | Editar `supabase/functions/pcm-auvo-webhook/index.ts`: antes do bloco `if (evento.entity !== AUVO_ENTITY_TASK)` atual, tentar `byWebhookEntity(evento.entity)`; se achar descriptor, chamar a função de task 2 e aplicar via `fn_apply_auvo_sync`; **handler de Task existente não muda uma linha** (AC-4) | AC-1, AC-2, AC-3, AC-4 | 2 | teste Deno de regressão: evento `entity=Task` produz o mesmo resultado de antes | todo |
| 4  | Edge Function `supabase/functions/pcm-auvo-pull/index.ts`: recebe `{ entity }`, resolve descriptor, pagina via `auvoPaginate` (reusa `_shared/auvo/paginate.ts`), mapeia com `fromAuvo`, upsert por `auvo_id` via `fn_apply_auvo_sync` (ou upsert em lote se o volume justificar — decisão de implementação), guarda de soft-delete em resultado vazio (mesmo padrão de `pcm-auvo-customers-import`) | AC-5, AC-6 | 1 | teste de integração Deno (mock HTTP Auvo): paginação completa, guarda de vazio, erro no meio propaga sem escrita parcial | todo |
| 5  | Edge Function one-shot `supabase/functions/pcm-auvo-webhooks-register/index.ts`: itera `registry` filtrando `webhookEntity` definido, `POST /webhooks` com `targetUrl` = `<SUPABASE_URL>/functions/v1/pcm-auvo-webhook`, loga o `id` retornado; reinvocação idempotente (Auvo atualiza por `id` se enviado, ou aceita o "already registered" como sinal de já-feito) | AC-7 | 1 | teste de integração Deno (mock HTTP Auvo): 2 invocações seguidas não geram erro nem duplicam a chamada de registro por entidade | todo |
| 6  | Rodar `pnpm run ci:local` + `supabase test db` (se Docker disponível) | todos | 1–5 | `pnpm run ci:local` | todo |
| 7  | Atualizar `docs/epics/ROADMAP.md` e `docs/STATE.md` | — | 6 | revisão humana | todo |

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
- [ ] (preencher durante a implementação se necessário)

## Checklist de Definition of Done
- [ ] Todos os AC (AC-1 a AC-7) verdes pelo gate executável
- [ ] AC-4 confirmado por teste de regressão explícito (não só ausência de erro — comparar o
      resultado exato antes/depois da mudança)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md` e `docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde; `db-tests` (Docker/CI) e os testes Deno confirmados no CI antes do merge
