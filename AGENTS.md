---
name: AGENTS
description: Fluxo enxuto (Spec Kit) e autoridade de comando dos agentes Triviaiox opcionais no Sinérgica SO. Lido pelo Codex; o Claude Code usa CLAUDE.md.
alwaysApply: false
---

# AGENTS.md — Sinérgica SO

`CLAUDE.md` é a fonte de verdade do fluxo (leia-o). Resumo para agentes que só leem este arquivo:

## Fluxo (E00-S25)
1. **Início:** `CLAUDE.md`, `docs/STATE.md`, e **só a linha da sua story** no ROADMAP:
   `grep -n "E0N-S0N" docs/epics/ROADMAP.md`. Nunca leia o `ROADMAP.md` inteiro. Marque o **owner** antes de codar.
2. **Trivial/bug:** branch → teste que falha → fix → PR. **Feature:** `speckit-specify` (com
   `SPECIFY_FEATURE_DIRECTORY=specs/E0N-S0N-<nome>`) → `speckit-plan` → `speckit-tasks` → `speckit-implement`.
3. **Arquitetural** (schema em produção, integração externa, novo bounded context): ADR antes de implementar + `/revisao-adversarial` antes do PASS.
4. Regras que valem sempre: `.specify/memory/constitution.md` (segurança OS-grade, migrations, DDD, TanStack Query, AC-N).
5. **Fechar:** CI verde (`gh pr checks`, com `db-tests`), linha da story fora do ROADMAP. `Definition-of-Done.md`.
- Não invoque skills de processo pesadas (brainstorming, planos longos, subagentes) em pedido comum. Rode teste focado; suíte cheia só no fim (`pnpm run ci:local`).

## Autoridade de comando (respeitar)
- **Só `@devops` ou humano:** `git push`, `git push --force`, `gh pr create/merge`, CI/CD, release. Nunca push em `main`: branch → PR.
- **`@dev`:** git **local** (`add/commit/status/branch/checkout/merge/stash/diff/log`); não altera AC/escopo da spec.
- **`@architect`:** decisões de arquitetura e ADR; delega DDL a `@data-engineer` (schema, migrations, RLS, query).

## Personas Triviaiox (opcionais, sob demanda)
Não fazem parte do caminho padrão. Use quando a tarefa pedir o especialista:
`@pm`, `@po`, `@sm`, `@analyst`, `@architect`, `@data-engineer`, `@dev`, `@qa`, `@security`,
`@reliability`, `@prompt-engineer` (feature com LLM: evals, injection, ver `ia/`), `@ux-design-expert`,
`@devops`, `@squad-creator`, `@triviaiox-master`.
Definições: `.claude/commands/TRIVIAIOX/agents/` (Claude Code) · `.codex/agents/` (Codex).
Ajustes da Trivia: `squads/trivia-os/`, nunca no core `.triviaiox-core/`.

## Skills (`.claude/skills/`)
`speckit-*` (fluxo de feature) · `/revisao-adversarial` · `/clarificar` (afiar spec ambígua) · `/handoff` (pausar/retomar via `docs/STATE.md`).
Skills antigas (`nova-feature`, `validar`, `revisar-pr`, `auditar`): `docs/_arquivo/skills/`.

## graphify
`graphify-out/graph.json` existe: para pergunta de código use `graphify query "<pergunta>"` (ou `path`/`explain`) antes de grep bruto. Após alterar código: `graphify update .`.
