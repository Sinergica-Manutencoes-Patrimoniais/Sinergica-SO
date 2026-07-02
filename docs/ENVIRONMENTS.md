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

## Promoção dev → staging → prod
1. Merge para `develop` → CI verde (branch protection) → `.github/workflows/deploy.yml` roda
   migrations + Edge Functions automaticamente no ambiente **staging** → smoke test.
2. Merge `develop` → `main` (PR, 1 aprovação) → CI verde → `deploy.yml` roda no ambiente
   **production**. Todo deploy já passou pelos gates porque a branch protection não deixa
   mergear sem CI verde.
3. Smoke test pós-deploy; se falhar, `runbooks/rollback-deploy.md`.
4. Deploy manual pela CLI (`supabase db push` / `functions deploy`) é **exceção de emergência**
   (`@devops`), não o caminho normal.

### Configurar o deploy automático (uma vez, por ambiente)
1. GitHub → Settings → Environments → criar `staging` e `production`.
2. Em cada environment, configurar os secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`,
   `SUPABASE_DB_PASSWORD` (apontando para o projeto Supabase daquele ambiente — nunca reutilize
   secret de produção em staging).
3. Sem os secrets configurados, `deploy.yml` falha visivelmente no step `Link ao projeto do
   ambiente` (fail-safe: não há deploy silencioso).
