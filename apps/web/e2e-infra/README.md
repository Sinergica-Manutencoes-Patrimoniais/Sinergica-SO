# E2E contra Supabase local (E00-S31 / SEC-006)

A suíte Playwright (`apps/web/e2e/`) **não roda contra produção**. Ela usa o Supabase local
(`supabase start`) com um seed fictício, e uma trava recusa a execução se a URL ou a chave
apontarem para o projeto de produção.

## Como rodar

```bash
# 1. Supabase local de pé (Docker). Use a mesma CLI do CI (2.114.0, ver ci.yml).
supabase start                    # aplica todas as migrations do zero
# 2. Suíte E2E (aplica e2e-infra/seed-e2e.sql e roda o Playwright)
apps/web/e2e-infra/rodar-e2e-local.sh                 # suíte inteira
apps/web/e2e-infra/rodar-e2e-local.sh e2e/kits.spec.ts   # um spec (args vão ao playwright)
```

Variáveis opcionais do script:

| Variável | Para quê |
|---|---|
| `SUPABASE_BIN` | caminho da CLI (padrão: `supabase` do PATH) |
| `SUPABASE_WORKDIR` | pasta com `supabase/config.toml` (padrão: raiz do repo). Útil para uma stack isolada com outro `project_id`/portas |
| `E2E_PORTA` | porta do dev server próprio da suíte (padrão 5179) |

O script lê `API_URL`/`ANON_KEY` de `supabase status`, confere a trava, aplica o seed com
`docker exec` no container `supabase_db_<project_id>` e chama `playwright test`.

## O que protege

1. **Trava na config** — `playwright.config.ts` chama `verificarBancoE2E` (`guarda-banco.ts`) ao
   carregar. URL ausente, URL ou chave anon com o ref de produção (`nudannsrfvjggoergvyn`), ou
   host que não seja local: o Playwright aborta antes do dev server e do primeiro teste.
   Projeto remoto de branch/preview só passa se listado em `E2E_SUPABASE_REFS_PERMITIDOS`
   (produção nunca passa, mesmo listada).
2. **Sem `.env.local`** — a config não lê mais o `.env.local` (que é de produção).
3. **Dev server próprio** — porta dedicada, `reuseExistingServer: false`; um `pnpm dev`
   aberto contra produção não é reaproveitado. As variáveis `VITE_SUPABASE_*` vão pelo
   ambiente do processo, que tem prioridade sobre os arquivos `.env` lidos pelo Vite.
4. **Navegador** — o Chromium da suíte não resolve `nudannsrfvjggoergvyn.supabase.co`.
5. **Login conferido** — `auth.setup.ts` exige que o login vá ao `VITE_SUPABASE_URL` da trava.
6. **Seed** — `seed-e2e.sql` recusa rodar sem `app.e2e_permitir_seed=sim` (só o script define)
   e só é aplicado via `docker exec` no container local.

## Seed fictício

`seed-e2e.sql`: usuário `e2e-superadmin@sinergica.invalid` (papel `superadmin`, senha só local
`e2e-local-somente`) e cadastros fictícios mínimos. Não é migration nem `db.seed`: não entra no
pgTAP do CI nem em produção. Idempotente.

## Specs fora da suíte padrão

- `calendario-contratual`, `capacidades-sso`, `estrutura-tecnica`, `plano-manutencao`: têm
  fixture e config próprias (`playwright.s1NN-isolado.config.ts`); ficam em `testIgnore`.
- A lista de specs que ainda dependem de dado específico está no PR da E00-S31.
