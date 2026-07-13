---
name: E01-S62-fix-timeout-sync-all
description: Fix — botão Sincronizar Auvo não criava OS novas (worker morria em pull:tickets antes do tasks-import).
alwaysApply: false
---

# Quick fix — E01-S62 · sync-all matava tasks-import por timeout do pull de tickets

**Achado (Lucas, 2026-07-13):** OS cadastradas no Auvo hoje não entraram no PCM mesmo clicando
"Sincronizar Auvo". Diagnóstico: `pcm.auvo_entity_status` mostrava pulls OK às 18:58 UTC e
`tickets` só às 19:00:27 — a janela de tickets (180d passado + 60d futuro, ~24 páginas) leva
~150s, e o `Promise.all` dos pulls em `runSyncAll` esperava por ela inteira antes de chamar
`tasks-import`, estourando o `WORKER_RESOURCE_LIMIT` (150s) do próprio worker do `sync-all`.
Confirmado contra a API real: 31 tarefas na janela de hoje, nenhuma virou OS.

**Fix:** `supabase/functions/pcm-auvo-sync-all/index.ts` — `pull:clientes` roda sozinho primeiro
(única dependência real do `tasks-import`, resolução de cliente em lote); todo o resto (demais
pulls, tasks-import, deleted-tasks, gps, support) roda em paralelo com **orçamento de tempo por
etapa** (`AbortController` + timeout em `makeSupabaseCaller`). Etapa que estoura o orçamento vira
falha isolada e nomeada no resultado agregado — nunca mais segura as demais até o teto do worker.
`tasks-import` ganha 90s de orçamento próprio (chegando sempre, mesmo se `pull:tickets` estourar).

Testes: `pcm-auvo-sync-all/index.test.ts` — ordem clientes-primeiro, orçamento por etapa
(`opts.timeoutMs` repassado), abort real do `makeSupabaseCaller` com fetch stub.

**Não verificado nesta sessão:** Deno CLI ausente (mesma ressalva de sempre) — typecheck/testes
Deno pendentes de CI. `pnpm run ci:local` (lado Node) não roda sobre Edge Functions Deno.
