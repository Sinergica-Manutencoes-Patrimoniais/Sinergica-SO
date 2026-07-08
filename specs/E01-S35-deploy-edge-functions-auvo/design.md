---
name: design
description: Technical Design Doc — deploy real das Edge Functions Auvo no CD + secrets + webhooks + smoke-test.
alwaysApply: false
---

# Technical Design Doc — Deploy das Edge Functions Auvo

> **Tier:** arquitetural · **Status:** rascunho
> **Autor:** sessão A · **Revisores:** Lucas (@devops) · **Data:** 2026-07-08
> Responde: **como** garantir que toda Edge Function chegue deployada e que um deploy quebrado nunca
> fique invisível.

## Contexto da funcionalidade
Toda a integração Auvo (E01-S09..S34) e o Atendimento (E02) foram escritos e mergeados em `main`, mas
**nenhuma Edge Function está deployada em produção**. Prova apurada:
- `supabase/config.toml` **não tem nenhum bloco `[functions.*]`** — nada declara as funções.
- `.github/workflows/deploy.yml` tem o trigger de `push` comentado; só roda em `workflow_dispatch` manual.
- Consequência: `supabase.functions.invoke("pcm-auvo-tickets-referencia")` (tela Tickets) e
  `invoke("pcm-auvo-users-create")` (cadastro de funcionário) retornam **404** — a função não existe no projeto.

O time acreditava que o deploy acontecia "pelo git". Este design elege **um** mecanismo canônico e o
torna auto-verificável. Ver `product.md`.

## Goals / Non-goals
**Goals**
- Todas as funções de `supabase/functions/` (exceto `_shared`/`_template`) deployadas a cada merge em `main`.
- Smoke-test pós-deploy que **falha o CI** se qualquer função responder 404.
- Um único mecanismo de deploy documentado (fim da ambiguidade nativo-vs-workflow).
- Webhooks Auvo registrados pós-deploy (idempotente).

**Non-goals**
- Gate estático `config.toml`↔`invoke` — é `E00-S11` (roda **antes** do merge; este design cobre o **pós**-deploy).
- Habilitar write path real / `writeEnabled` — `E01-S36`.
- Setar os valores dos secrets (ação manual do Lucas no dashboard).

## Design proposto

### Mecanismo canônico: integração nativa Supabase↔GitHub
O Supabase deploya automaticamente funções declaradas em `config.toml` no push do branch de produção
(o próprio header de `deploy.yml` já cita esse caminho como o canônico). Decisão: **adotar o nativo como
fonte de verdade** e reduzir `deploy.yml` ao papel de **verificador** (smoke-test) + fallback manual.

```
merge → main
  │
  ├── Supabase GitHub integration  ── deploya [functions.*] de config.toml
  │
  └── .github/workflows/deploy.yml (on: push main)
        └── job "smoke-edge-functions"
              para cada função declarada em config.toml:
                curl -sS -o /dev/null -w "%{http_code}"  <PROJECT_URL>/functions/v1/<nome>
                (OPTIONS ou POST vazio) → 404 ⇒ exit 1
```

### Declaração em config.toml
Bloco por função, com `verify_jwt` conforme a natureza:
```toml
[functions.pcm-auvo-webhook]          # público: Auvo chama, valida HMAC no corpo
verify_jwt = false
[functions.pcm-auvo-tickets-referencia] # interno: chamado pela UI autenticada
verify_jwt = true
```
A **matriz `verify_jwt` por função** (task 1) é o artefato de decisão: webhooks e o registro de webhook
são públicos (validam assinatura própria); o resto exige JWT.

### Smoke-test
Um script (`scripts/smoke-edge-functions.mjs` ou inline no workflow) lê a lista de `[functions.*]` do
`config.toml`, monta a URL de cada uma e faz um probe leve (`OPTIONS`, ou `POST {}` tolerando 400/401 mas
**não** 404). Qualquer 404 = função não deployada = `exit 1`.

### Registro de webhooks
`pcm-auvo-webhooks-register` roda uma vez pós-deploy (job manual ou step guardado por flag). Idempotente:
consulta os webhooks existentes no Auvo antes de criar (não duplica).

## Cobertura dos 5 eixos

### 1. Tech stack
Sem lib nova. `supabase/config.toml`, GitHub Actions (`deploy.yml`), Supabase CLI/integração nativa, `curl`/Node no smoke.

### 2. Arquitetura base
Não toca camadas DDD. É infra de deploy das Edge Functions (`supabase/functions/`). Fronteira: nenhuma nova.

### 3. Infra
Recursos: nenhum novo runtime. Deploy passa a ser automático no merge. **Reversão segura:** se o smoke
falhar, o CI fica vermelho e o merge é revertido/refeito — funções já deployadas continuam; o smoke não
faz rollback, só denuncia. Secrets: `AUVO_API_KEY`/`AUVO_USER_TOKEN` (Edge secrets), Vault
`auvo_trigger_project_url`/`auvo_trigger_service_role_key` (usados pelos crons de `0011`/`0037`/`0038`).

### 4. Qualidade
- **Smoke-test (contrato de deploy):** cada função responde ≠404 (AC-5). Teste do próprio smoke: remover
  temporariamente uma função da lista e confirmar que o job fica vermelho.
- **Aceite manual (dev/staging, nunca prod Netlify):** tela Tickets 200 (AC-2), webhooks registrados (AC-3).
- Sem budget de performance relevante (deploy, não hot path).

### 5. Observabilidade
O smoke-test é a telemetria de deploy: o log do job lista cada função + status HTTP. Um deploy parcial
aparece como job vermelho com a função culpada nomeada. Complementa a view `pcm.auvo_sync_health` (E00-S11)
para o runtime.

## Mapa de dependências
| Dependência | Tipo | Descrição | Métodos / endpoints |
|-------------|------|-----------|---------------------|
| Supabase Functions (deploy) | Plataforma | Deploya `[functions.*]` no push | Integração nativa Supabase↔GitHub |
| Auvo API | REST | Login + registro de webhook | `GET /login` · webhooks endpoints (via `pcm-auvo-webhooks-register`) |
| GitHub Actions | CI/CD | Smoke pós-deploy | `deploy.yml` job `smoke-edge-functions` |

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| A (escolhida) Nativo Supabase + workflow só como smoke | Menos código, sem gerir token de deploy no Actions | Depende da integração estar configurada no projeto | Menor superfície; header do `deploy.yml` já a trata como canônica |
| B `supabase functions deploy` no workflow | Controle total no CI | Exige `SUPABASE_ACCESS_TOKEN`/project-ref no Actions, dois caminhos divergindo | Duplica mecanismo (a ambiguidade que causou o incidente) |

## Trade-offs e consequências
Ganha: deploy determinístico + alarme imediato de deploy quebrado. Aceita: dependência da integração
nativa estar ligada no projeto — mitigado por AC-6 (falhar explícito se inativa) e pelo fallback manual.

## Riscos
| Risco | Descrição | Prob. × Impacto | Ações / mitigações |
|-------|-----------|-----------------|--------------------|
| Integração nativa não configurada | Nada deploya, smoke acusa mas nada corrige | médio × alto | AC-6: workflow falha explícito se deploy não ocorreu; runbook de como ligar |
| `verify_jwt` errado | Função pública exige JWT (webhook Auvo quebra) ou interna fica exposta | médio × alto | Matriz por função revisada (task 1); smoke não pega semântica de auth — validar no aceite |
| Secret ausente | Função deploya mas retorna erro em runtime | alto × médio | Smoke pega 5xx? Não — pega 404. Complementar: probe que aceita 401/400, não 5xx; runbook de secrets |

## Roadmap da feature
| Fase | Entrega | Depende de |
|------|---------|------------|
| 1 (MVP) | config.toml declara tudo + deploy nativo + smoke básico | — |
| 2 | webhooks registrados + runbook + matriz verify_jwt revisada | 1 |

## Questões em aberto
- [ ] A integração nativa Supabase↔GitHub está ligada no projeto de produção? (Lucas confirma) — decide se o MVP é "declarar+confiar no nativo" ou "deployar pelo workflow".
- [ ] Probe do smoke deve tolerar 401/400 (função protegida responde sem corpo válido) e falhar só em 404/5xx — confirmar códigos aceitáveis por função.

> ADR a criar: `docs/adr/000N-mecanismo-canonico-deploy-edge-functions.md` (decisão nativo vs workflow — difícil de reverter).
