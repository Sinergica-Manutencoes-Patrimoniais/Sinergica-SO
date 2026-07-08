---
name: runbook-deploy-edge-functions
description: Runbook de deploy das Edge Functions Auvo/Atendimento — mecanismo canônico, secrets, como confirmar que rodou. Puxe ao configurar produção ou investigar 404 em functions.invoke.
alwaysApply: false
---

# Runbook — Deploy das Edge Functions

> Nasce do incidente E01-S35: o time assumiu que o deploy rodava "pelo git" e não rodava — nenhuma
> função em `supabase/functions/` estava declarada em `config.toml`, e toda `functions.invoke` da
> UI dava 404 sem aviso nenhum. Este runbook existe para nunca mais precisar descobrir isso por um
> print de erro do usuário.

## Cenário
Configurar o deploy de Edge Functions pela primeira vez, adicionar uma função nova, ou investigar
por que `functions.invoke("<nome>")` está retornando 404 em produção.

## Mecanismo canônico (decisão registrada)
**A GitHub Integration nativa do Supabase é a única fonte de verdade de deploy.**
Dashboard do projeto → **Settings → Integrations → GitHub → "Deploy to production"**. Ela aplica, a
cada push no branch de produção:
- migrations (`supabase/migrations/*.sql`);
- Edge Functions **declaradas em `supabase/config.toml`** (bloco `[functions.<nome>]`).

`.github/workflows/deploy.yml` **não é** o caminho de deploy — é um fallback manual
(`workflow_dispatch` só) para o cenário (não aplicável hoje) de monorepo com mais de um projeto
Supabase. Não reative o `on: push` dele sem antes desligar a integração nativa (ver o próprio
cabeçalho do arquivo) — os dois rodando juntos aplicam a mesma migration duas vezes.

## Sintomas de deploy quebrado
- Console do browser: `Failed to send a request to the Edge Function` / `404`.
- `supabase.functions.invoke(...)` retorna `error` com status 404.
- Job **"Smoke-test Edge Functions (pós-deploy)"** (`.github/workflows/smoke-edge-functions.yml`)
  vermelho no Actions.

## Diagnóstico rápido
1. A função está em `supabase/functions/<nome>/`? Se não existir, é bug de código, não de deploy.
2. Ela tem um bloco `[functions.<nome>]` em `supabase/config.toml`? Se não tiver, **é a causa** —
   `pnpm run check:edge-functions` (E00-S11) já deveria ter barrado isso no PR.
3. A integração nativa está ativa? Dashboard → Settings → Integrations → GitHub → confirmar
   "Deploy to production" ligado e apontando para o branch certo.
4. Rodar `node scripts/smoke-edge-functions.mjs` localmente com `SUPABASE_PROJECT_ID` do projeto
   para ver o status de cada função uma a uma.

## Procedimento — adicionar uma função nova
1. Criar `supabase/functions/<nome>/index.ts` (usar `_template/` como base).
2. Adicionar `[functions.<nome>]` em `supabase/config.toml` com `verify_jwt` correto:
   - `false` **só** se a função é chamada por um sistema externo sem JWT do Supabase e valida a
     si mesma por assinatura própria (HMAC) — ex.: `pcm-auvo-webhook`, `pcm-whatsapp-webhook`.
   - `true` em todos os outros casos (chamada da UI com sessão do usuário, ou sistema→sistema
     interno com Bearer = `service_role` key via `requireServiceRole`).
3. `pnpm run check:edge-functions` local — deve passar.
4. Se a função precisa de secret novo (`Deno.env.get(...)`), adicionar em
   `.github/workflows/sync-secrets.yml` e rodar esse workflow manualmente (`workflow_dispatch`)
   **antes** do merge que ativa a função em produção — senão ela deploya mas quebra em runtime por
   secret ausente.
5. Merge em `main` → integração nativa deploya → workflow de smoke-test confirma (200/4xx, nunca
   404) → se vermelho, ver Diagnóstico rápido acima.

## Secrets necessários (Edge Functions, produção)
| Secret | Onde vive | Usado por |
|--------|-----------|-----------|
| `AUVO_API_KEY` / `AUVO_USER_TOKEN` | Edge Function secret (`supabase secrets set`, via `sync-secrets.yml`) | `_shared/auvo/client.ts` — toda chamada à API Auvo |
| `AUVO_WEBHOOK_SECRET` | idem | `pcm-auvo-webhook` — valida assinatura HMAC do Auvo |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_HMAC_SECRET` | idem | `pcm-whatsapp-webhook`, `atendimento-whatsapp-envio` |
| `META_ACCESS_TOKEN` / `META_APP_SECRET` | idem | `atendimento-meta`, `atendimento-meta-webhook` |
| `OPENROUTER_API_KEY` | idem | `pcm-ze-agent` |
| `auvo_trigger_project_url` / `auvo_trigger_service_role_key` | **Vault** do Postgres (não é secret de Edge Function) | crons `pg_cron` (`0011`/`0037`/`0038`) chamando Edge Functions via `net.http_post` |
| `SUPABASE_PROJECT_ID` | GitHub Actions secret | `deploy.yml`, `sync-secrets.yml`, `smoke-edge-functions.yml` |

Setar os valores é ação manual do Lucas (dashboard Supabase / `gh secret set`) — este runbook não
codifica os valores em si, só a lista do que precisa existir.

## Validação (resolvido?)
- [ ] `pnpm run check:edge-functions` verde (toda função declarada).
- [ ] Workflow "Smoke-test Edge Functions" verde no Actions (toda função responde ≠404).
- [ ] Tela que consome a função (ex.: Tickets, cadastro de funcionário) funciona em dev/staging —
      **nunca testar contra a URL pública de produção do Netlify**.

## Pós-incidente
- Se o 404 voltar a acontecer, verificar primeiro se alguém desligou a integração nativa ou se um
  PR passou por cima do gate `check:edge-functions` (não deveria ser possível — investigar como).
