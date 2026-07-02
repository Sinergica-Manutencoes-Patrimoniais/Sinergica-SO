---
name: PADRAO-DE-QUALIDADE
description: Matriz única de qualidade — cada bar, como é garantido (gate/hook/checklist/guia), perfil e dono. Puxe para ter a visão do que o Padrão OS garante.
alwaysApply: false
---

# Padrão de Qualidade — o que o Padrão OS garante

> **Visão única.** Cada barra de qualidade abaixo tem **como é garantida** (gate automático na CI /
> hook local / checklist no DoD / guia), em **qual perfil** vale, e **quem é dono**. "Pronto" é
> **gate verde por comando**, nunca inspeção visual. Detalhe de cada item está no doc referenciado.

## Legenda de enforcement
- 🟢 **Gate CI** — falha o build automaticamente (bloqueante).
- 🪝 **Hook local** — Lefthook, antes do commit/push (`lefthook.yml`; paralelo).
- ☑️ **Checklist DoD** — verificado no PR (`Definition-of-Done.md`).
- 📖 **Guia** — padrão documentado, aplicado pelo agente/dev e revisado por agente.

## Matriz

| # | Barra de qualidade | Enforcement | Comando / origem | Perfil | Dono |
|---|--------------------|-------------|------------------|--------|------|
| **Confiabilidade / Método** |
| 1 | Todo `AC` coberto por task (rastreabilidade) | 🟢 Gate CI | `pnpm run eval:spec` | ambos | @qa |
| 2 | Integridade da esteira (frontmatter, links, specs) | 🟢 Gate CI | `pnpm run audit:esteira` | ambos | @architect |
| 3 | Cada `AC` tem teste de aceite verde | 🟢 Gate CI | `pnpm test` | ambos | @qa |
| 4 | Diagramas Mermaid válidos | 🟢 Gate CI | `validate-mermaid.mjs` | ambos | @architect |
| 5 | Sem `SPEC_DEVIATION` pendente | ☑️ DoD | `Definition-of-Done.md` | ambos | @dev |
| 5a | Revisão adversarial antes do PASS (tenta quebrar, não confirma) | ☑️ DoD / 📖 | `.claude/skills/revisao-adversarial` | ambos | @qa + @security |
| 6 | Decisão difícil de reverter vira ADR | ☑️ DoD / 📖 | `docs/adr/`, `ANTI-PADROES.md` | ambos | @architect |
| 7 | Runbook para incidente recorrente | 📖 Guia | `runbooks/` | ambos | @reliability |
| 7a | Deploy de banco/Edge Functions via GitHub (não manual) | 🟢 Gate CI* | GitHub Integration nativa do Supabase (`supabase/config.toml`); fallback `deploy.yml` | ambos | @devops |
| **Código / Arquitetura** |
| 8 | Lint + format limpos | 🟢 Gate CI + 🪝 | `pnpm run lint` (Biome) | ambos | @dev |
| 9 | TypeScript strict sem erro | 🟢 Gate CI + 🪝 | `pnpm run typecheck` | ambos | @dev |
| 10 | Cobertura ≥ threshold (`apps/web`) | 🟢 Gate CI | `pnpm --filter @sinergica/web test:coverage` (`vitest.config.ts`) | ambos | @qa |
| 11 | Dependência aponta só para dentro (DDD) | 🟢 Gate CI | `pnpm run arch:check` (`.dependency-cruiser.cjs`) | ambos | @architect |
| 12 | Conventional commits | 🪝 Hook | Lefthook `commit-msg` (commitlint) | ambos | @dev |
| 13 | Sem over-engineering (YAGNI, tier certo) | 📖 Guia | `ANTI-PADROES.md` | ambos | @architect |
| **Segurança** |
| 14 | Sem segredo commitado | 🟢 Gate CI | gitleaks | ambos | @security |
| 15 | Sem dependência com vuln alta+ | 🟢 Gate CI | `pnpm run audit:deps` | ambos | @security |
| 16 | Input validado na borda (Zod) | ☑️ DoD / 📖 | `seguranca/baseline-minimo.md` | ambos | @dev |
| 17 | JWT validado; sem secret no client | ☑️ DoD / 📖 | `baseline-minimo.md` | ambos | @security |
| 18 | RLS em toda tabela (+ FORCE no OS) | ☑️ DoD / 📖 | `db/rls.template.sql`, `db/rls-test.md` | ambos | @data-engineer |
| 18a | CREATE POLICY tem GRANT (RLS roda após privilégio) | 🟢 Gate CI | `pnpm run lint:migrations` | ambos | @data-engineer |
| 18b | Migration segura (sem lock/breaking-change perigoso) | 🟢 Gate CI | Squawk (`.squawk.toml`, squawk-action) | ambos | @data-engineer |
| 19 | Threat model STRIDE (auth/PII/financeiro/integração) | 📖 Guia | `seguranca/threat-model.template.md` | quando aplicável | @security |
| 20 | Dívida de segurança registrada (P0 bloqueia) | ☑️ DoD | `docs/SECURITY_DEBT.md` | ambos | @security |
| 21 | OS-grade: audit append-only, Vault, HMAC webhook | 📖 Guia | `os-layer/seguranca/os-grade.md` | OS | @security |
| **Performance** |
| 22 | Budget (Web Vitals / p95 / bundle) sem regressão | ☑️ DoD / 📖 | `performance/README.md` | ambos | @dev |
| 23 | Query crítica indexada; lista paginada; sem N+1 | ☑️ DoD / 📖 | `performance/README.md`, `db/README.md` | ambos | @data-engineer |
| 24 | Lighthouse CI / size-limit (quando há app web) | 🟢 Gate CI* | pipeline (ligar quando houver app) | ambos | @dev |
| **Observabilidade** |
| 25 | Erro na borda em `problem+json` com `reqId` | ☑️ DoD / 📖 | `src/interfaces/http/problem.ts` | ambos | @dev |
| 26 | Log estruturado, sem PII | ☑️ DoD / 📖 | `src/shared/log.ts`, `observabilidade/` | ambos | @dev |
| 27 | SLO/SLI no caminho crítico | 📖 Guia | `observabilidade/slo-sli.template.md` | OS / crítico | @reliability |
| **Produtos de IA (LLM)** |
| 28 | Evals com casos adversariais | 📖 Guia | `ia/evals.md` | quando há LLM | @prompt-engineer |
| 29 | Prompt versionado + defesa contra injection | 📖 Guia | `ia/prompt-e-injection.md` | quando há LLM | @prompt-engineer |
| 30 | OWASP LLM Top 10 revisado | 📖 Guia | `ia/README.md` | quando há LLM | @security/@qa |

> \* Item 24 é gate quando o projeto tem app web (liga Lighthouse CI/size-limit); até lá, é guia + DoD.
> \* Item 7a é gate por integração nativa do Supabase (não pipeline neste repo) — falha visível
>   se a migration for inválida (ative o "required check" na proteção da branch).

## Como rodar tudo localmente (espelho da CI)
```bash
pnpm run ci:local   # = `lefthook run pre-push`: a MESMA bateria do pipeline, em paralelo
```
`ci:local` é o **espelho da CI** definido em `lefthook.yml` (uma fonte só para hook e comando):
esteira, fidelidade, Mermaid, migrations (Squawk + RLS-GRANT), lint (Biome), typecheck,
arch:check, build e testes. Squawk e gitleaks são best-effort local (bloqueiam na CI). **Se
`ci:local` passa, o pipeline deve passar** — exceto o job `db-tests` (RLS/pgTAP via Docker), que
exige ambiente local com Docker e por isso só roda garantido na CI.

### Ferramentas (opensource, nada caseiro além do essencial)
| Papel | Ferramenta | Cobre |
|---|---|---|
| Orquestrador de gates | **Lefthook** | commit/push, paralelo — 1 arquivo (`lefthook.yml`) |
| Lint + format | **Biome** | JS/TS/JSX/TSX/JSON |
| Tipos | **tsc** | TypeScript strict |
| Arquitetura | **dependency-cruiser** | regra de dependência DDD |
| Testes | **Vitest** | AC |
| Segurança de migration | **Squawk** | lock/breaking-change em Postgres |
| Segredos | **gitleaks** | secret scanning |
| RLS-GRANT (semântico) | `scripts/lint-migrations.mjs` | única regra sem tool pronto |

> **Local não substitui o CI real.** Gate que precisa de Docker/banco (`db-tests`) pode ser pulado
> local. Antes de considerar pronto, confira `gh pr checks`. O `/validar` (@qa) exige isso.

A skill `/validar` (@qa) executa esses gates + o CI real + `/revisao-adversarial` e emite
**PASS / CONCERNS / FAIL**.
