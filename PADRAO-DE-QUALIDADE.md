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
- 🪝 **Hook local** — Husky, antes do push/commit.
- ☑️ **Checklist DoD** — verificado no PR (`Definition-of-Done.md`).
- 📖 **Guia** — padrão documentado, aplicado pelo agente/dev e revisado por agente.

## Matriz

| # | Barra de qualidade | Enforcement | Comando / origem | Perfil | Dono |
|---|--------------------|-------------|------------------|--------|------|
| **Confiabilidade / Método** |
| 1 | Todo `AC` coberto por task (rastreabilidade) | 🟢 Gate CI | `npm run eval:spec` | ambos | @qa |
| 2 | Integridade da esteira (frontmatter, links, specs) | 🟢 Gate CI | `npm run audit:esteira` | ambos | @architect |
| 3 | Cada `AC` tem teste de aceite verde | 🟢 Gate CI | `npm test` / `test:coverage` | ambos | @qa |
| 4 | Diagramas Mermaid válidos | 🟢 Gate CI | `validate-mermaid.mjs` | ambos | @architect |
| 5 | Sem `SPEC_DEVIATION` pendente | ☑️ DoD | `Definition-of-Done.md` | ambos | @dev |
| 6 | Decisão difícil de reverter vira ADR | ☑️ DoD / 📖 | `docs/adr/`, `ANTI-PADROES.md` | ambos | @architect |
| 7 | Runbook para incidente recorrente | 📖 Guia | `runbooks/` | ambos | @reliability |
| 7a | Deploy de banco/Edge Functions via GitHub (não manual) | 🟢 Gate CI* | GitHub Integration nativa do Supabase (`supabase/config.toml`); fallback `deploy.yml` | ambos | @devops |
| **Código / Arquitetura** |
| 8 | Lint + format limpos | 🟢 Gate CI + 🪝 | `npm run lint` (Biome) | ambos | @dev |
| 9 | TypeScript strict sem erro | 🟢 Gate CI + 🪝 | `npm run typecheck` | ambos | @dev |
| 10 | Cobertura ≥ threshold | 🟢 Gate CI | `npm run test:coverage` (`vitest.config.ts`) | ambos | @qa |
| 11 | Dependência aponta só para dentro (DDD) | 🟢 Gate CI | `npm run arch:check` (`.dependency-cruiser.cjs`) | ambos | @architect |
| 12 | Conventional commits | 🪝 Hook | `commit-msg` (commitlint) | ambos | @dev |
| 13 | Sem over-engineering (YAGNI, tier certo) | 📖 Guia | `ANTI-PADROES.md` | ambos | @architect |
| **Segurança** |
| 14 | Sem segredo commitado | 🟢 Gate CI | gitleaks | ambos | @security |
| 15 | Sem dependência com vuln alta+ | 🟢 Gate CI | `npm run audit:deps` | ambos | @security |
| 16 | Input validado na borda (Zod) | ☑️ DoD / 📖 | `seguranca/baseline-minimo.md` | ambos | @dev |
| 17 | JWT validado; sem secret no client | ☑️ DoD / 📖 | `baseline-minimo.md` | ambos | @security |
| 18 | RLS em toda tabela (+ FORCE no OS) | ☑️ DoD / 📖 | `db/rls.template.sql`, `db/rls-test.md` | ambos | @data-engineer |
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
npm run audit:esteira && npm run eval:spec && node scripts/validate-mermaid.mjs \
  && npm run lint && npm run typecheck && npm run test:coverage \
  && npm run audit:deps && npm run arch:check
# secret scanning: gitleaks detect (se instalado localmente)
```
A skill `/validar` (@qa) executa esses gates e emite **PASS / CONCERNS / FAIL**.
