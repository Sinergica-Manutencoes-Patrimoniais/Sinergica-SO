---
name: tasks-E01-S05-visitas-laudo-pdf
description: Tasks — OS síncrona do PMOC, webhook→pmoc_records, laudo PDF, cron de atraso.
alwaysApply: false
---

# Tasks — E01-S05: Visitas, registro e laudo PDF

## Plano
| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Migration `0104`: bucket Storage `pmoc-laudos` (privado) + policies RLS (select/insert por `pcm`) | AC-3 | `pnpm run lint:migrations` | ☑ |
| 2 | application `pmoc.ts`: `criarOsDaVisitaPmoc(gatewayOs, schedule)` — monta `CriarOrdemServicoInput` com `categoria='preventiva'`, chama `abrirOrdemServico` passando o schedule via `pmocScheduleId` (E01-S07) | AC-1 | `pnpm test` | ☑ |
| 3 | UI `PmocPage.tsx`: botão "Criar OS" em cada linha do cronograma sem OS vinculada (checa `ordens_servico` carregadas por `pmoc_schedule_id`); desabilita/some quando já tem | AC-1 | `pnpm build` | ☑ |
| 4 | Webhook `pcm-auvo-webhook/index.ts`: fecha SPEC_DEVIATION AC-7 — cria `pmoc_records` + marca schedule `realizado` na finalização, idempotente | AC-2 | deploy (Deno, sem CI local) | ☑ |
| 5 | Edge Function nova `pmoc-generate-pdf`: gera PDF (`pdf-lib`, Deno-compatível), sobe pro bucket, grava `pdf_url`; se e-mail ativo (E00-S12) envia via Resend REST, senão loga e segue | AC-3, AC-4 | deploy (Deno) | ☑ |
| 6 | Migration `0105`: `pcm.fn_pmoc_marcar_atrasadas()` (SQL puro, sem Edge Function) + `cron.schedule` diário 00:01 | AC-5 | `pnpm run lint:migrations` | ☑ |
| 7 | Deploy real via `supabase functions deploy` + `supabase db push` | — | CLI | ☑ (migrations + as 2 functions deployadas — token corrigido pelo Lucas) |
| 8 | ROADMAP + STATE | — | `pnpm run ci:local` | ☑ |

## Bloqueio resolvido
`SUPABASE_ACCESS_TOKEN` em `.env.local` tinha formato inválido (`sbp_v0_<40hex>`, 47 chars — CLI
espera `sbp_<40hex>`, 44). Lucas gerou um novo Personal Access Token; substituído em `.env.local`
(gitignored, nunca commitado). Deploy confirmado:
```
supabase functions deploy pmoc-generate-pdf --use-api   # v1, novo
supabase functions deploy pcm-auvo-webhook --use-api    # v30→v31
```
Smoke test manual (sem esperar por `SUPABASE_PROJECT_ID`, que o script `smoke-edge-functions.mjs`
do CI exige e não está setado neste ambiente): `pmoc-generate-pdf` responde `401
UNAUTHORIZED_NO_AUTH_HEADER` sem Authorization (esperado — confirma que está no ar, não 404);
`pcm-auvo-webhook` responde `401 "Assinatura inválida"` sem HMAC (idem). Ambas ACTIVE em
`supabase functions list`.

## Plano de teste
- **Unidade (Vitest):** `criarOsDaVisitaPmoc` monta o input corretamente (categoria/pmocScheduleId).
- **Deno (não executável neste ambiente — sem Deno CLI, mesma ressalva recorrente do repo):**
  webhook idempotência, geração de PDF, envio condicional de e-mail. Verificados por leitura de
  código + smoke test pós-deploy (invocar manualmente, checar log/HTTP status), não por suíte automatizada.

## Divergências (SPEC_DEVIATION)
- **Checklist/NCs vazios no `pmoc_records` criado pelo webhook** — payload de finalização de tarefa
  do Auvo não traz estrutura de checklist confirmada; registrado na spec.md (Casos de borda), não
  reaberto aqui.

## Definition of Done
- [x] AC-1..AC-5 — verificados por leitura de código + smoke test pós-deploy (Deno não roda localmente)
- [x] Migrations aplicadas em produção (`0104`/`0105`)
- [x] Edge Functions deployadas (`pmoc-generate-pdf` v1, `pcm-auvo-webhook` v31) e confirmadas ACTIVE
- [x] Cron agendado (`pmoc_daily_status`, via `cron.schedule` na migration `0105`)
- [x] ROADMAP + STATE atualizados
