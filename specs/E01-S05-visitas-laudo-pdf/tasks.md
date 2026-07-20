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
| 7 | Deploy real via `supabase functions deploy` + `supabase db push` | — | CLI | ⚠ (migrations 0104/0105 aplicadas; deploy das 2 functions BLOQUEADO — ver Bloqueios) |
| 8 | ROADMAP + STATE | — | `pnpm run ci:local` | ☑ |

## Bloqueios
- **`SUPABASE_ACCESS_TOKEN` inválido em `.env.local`** — formato `sbp_v0_<40 hex>` (47 chars), o
  Supabase CLI (testado nas versões 2.90.0 e 2.109.1, mesmo erro nas duas — não é bug de versão)
  espera `sbp_<40 hex>` (44 chars) e rejeita com `LegacyInvalidAccessTokenError` antes de qualquer
  chamada de rede. Bloqueia `supabase functions deploy` (novo `pmoc-generate-pdf` e o redeploy do
  `pcm-auvo-webhook` modificado) — **não bloqueia** `supabase db push` (usa a connection string do
  Postgres, token diferente), por isso as migrations 0100-0105 foram aplicadas normalmente.
  **Ação necessária:** gerar um novo Personal Access Token em
  https://supabase.com/dashboard/account/tokens e substituir `SUPABASE_ACCESS_TOKEN` em
  `.env.local`. Depois, rodar:
  ```
  supabase functions deploy pmoc-generate-pdf --use-api
  supabase functions deploy pcm-auvo-webhook --use-api
  ```
  Até lá: o código roda em produção **exatamente como antes desta story** — o webhook segue sem o
  fechamento do SPEC_DEVIATION AC-7 (nenhum `pmoc_records` é criado ao finalizar OS PMOC) e
  `pmoc-generate-pdf` não existe no ambiente Auvo. Nenhuma regressão — só a entrega desta story
  ainda não está ativa.

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
- [ ] AC-1..AC-5 — verificados por leitura de código + smoke test pós-deploy (Deno não roda localmente)
- [ ] Migrations aplicadas em produção
- [ ] Edge Functions deployadas (`supabase functions deploy`)
- [ ] Cron agendado
- [ ] ROADMAP + STATE atualizados
