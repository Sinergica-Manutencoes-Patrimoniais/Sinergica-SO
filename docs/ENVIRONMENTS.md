---
name: ENVIRONMENTS
description: Ambientes (dev/staging/prod), variáveis e secrets, promoção. Puxe ao configurar ambiente ou secret.
alwaysApply: false
---

# Ambientes e configuração

> Config validada no boot (`config/env.ts`, fail-fast). Segredo nunca no client nem no git
> (gate gitleaks). Ver `seguranca/baseline-minimo.md`.

## Ambientes
| Ambiente   | Para quê                        | Branch    | Dados                         |
|------------|---------------------------------|-----------|-------------------------------|
| dev/local  | desenvolvimento                 | feat/*    | Supabase local ou projeto dev |
| staging    | validação antes de produção     | develop   | projeto Supabase de staging   |
| produção   | usuários reais                  | main      | projeto Supabase de produção  |

> Single-repo pode começar com **dev + produção** e adicionar staging quando o ritmo exigir.

## Variáveis (onde cada uma vive)
| Variável                     | Client? | Onde fica                          |
|------------------------------|---------|------------------------------------|
| `VITE_SUPABASE_URL`/`*_ANON_KEY` | sim | `.env.local` (dev) / env do host (prod) |
| `SUPABASE_SERVICE_ROLE_KEY`  | **não** | secret do host / `supabase secrets` |
| Tokens/webhook secrets       | **não** | `supabase secrets set` / Vault (OS) |

- Cada ambiente tem seu conjunto de secrets (configure em todos). Nunca reutilize secret de prod em dev.
- `.env.local` no `.gitignore`; commite um `.env.example` só com as chaves (sem valores).

## Secrets (Supabase)
```bash
supabase secrets set NOME=valor      # por projeto/ambiente
supabase secrets list                # sem mostrar valores
```
Rotacione ao suspeitar de vazamento; registre rotação. Refresh token de OAuth no Vault (perfil OS).

## CD (banco + Edge Functions) — caminho canônico: GitHub Integration nativa
No **próprio projeto Supabase**: Settings → Integrations → GitHub → conecte o repositório →
ative **"Deploy to production"**. A partir daí, todo merge na `production branch` configurada
(`main`) aplica automaticamente:
- **Migrations** de `supabase/migrations/`;
- **Edge Functions** e **Storage buckets** — mas **só os que estiverem declarados em
  `supabase/config.toml`** (`[functions.<nome>]` / `[storage.buckets.<nome>]`); a integração lê o
  `config.toml`, não escaneia `supabase/functions/`. Toda função nova precisa da entrada lá, senão
  a integração aplica só as migrations em silêncio (a função não vai, sem erro visível).

**Por que este é o caminho certo (não o Action com token do `deploy.yml`):** o acesso nasce
amarrado *àquele projeto e àquele repositório* no momento em que você conecta — nenhum Personal
Access Token de conta (que carregaria acesso à sua conta Supabase inteira) precisa existir como
secret do GitHub. Funciona no plano Free; *branching* (banco de preview por PR) é que exige Pro+.

- **Staging:** conecte a integração de novo a partir do **projeto Supabase de staging**, com
  `production branch = develop`. Cada projeto Supabase tem sua própria conexão/branch.
- **Confira antes de confiar:** um "required check" da integração no PR falha o merge se a
  migration for inválida — ative-o na proteção da branch.

## Fallback: CD via Action (`.github/workflows/deploy.yml`) — só se a integração não servir
Caso real: monorepo com **mais de um projeto Supabase no mesmo repo** (a integração nativa é
1 projeto ↔ 1 repo/pasta) — não é o caso deste repo hoje, por isso o workflow existe mas com o
gatilho automático desligado (só `workflow_dispatch`). Se um dia for ativado, **desligue** "Deploy
to production" na integração para não aplicar a mesma migration duas vezes, e gere o
`SUPABASE_ACCESS_TOKEN` de uma **conta de automação**, nunca da conta pessoal:

### Conta de automação (para o token do fallback)
Um PAT do Supabase carrega os privilégios da conta inteira — não existe token nativo restrito a
um projeto. Para isolar: crie uma conta Supabase separada (ex.: `ci@seudominio` ou um alias),
convide-a como membro **apenas** da organização/projeto que a CI precisa tocar, e gere o PAT **a
partir dessa conta**. É essa conta-bot que vai no secret — nunca a conta principal.

| Secret | O que é | Onde obter |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | PAT da conta de automação (não da conta pessoal) | supabase.com/dashboard/account/tokens, logado como a conta-bot |
| `SUPABASE_PROJECT_ID` | ref do projeto daquele ambiente | URL/settings do projeto Supabase |
| `SUPABASE_DB_PASSWORD` | senha do banco (para `db push`) | definida na criação do projeto |

Configuração (se ativado): GitHub → Settings → Environments → criar `staging`/`production` → os 3
secrets acima em cada um, apontando para o projeto Supabase correspondente (nunca reutilize
secret de produção em staging).

## Promoção dev → staging → prod
1. Merge para `develop` → CI verde (branch protection) → **integração nativa deploya staging
   automaticamente** → smoke test.
2. Merge `develop` → `main` (PR, 1 aprovação) → CI verde → **integração nativa deploya produção**
   (autoridade: `@devops`, que faz o merge). Todo deploy já passou pelos gates porque a branch
   protection não deixa mergear sem CI verde.
3. Smoke test pós-deploy; se falhar, `runbooks/rollback-deploy.md`.
4. Deploy manual pela CLI (`supabase db push` / `functions deploy`) é **exceção de emergência**
   (`@devops`), não o caminho normal.
