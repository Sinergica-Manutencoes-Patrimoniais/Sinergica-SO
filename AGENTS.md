---
name: AGENTS
description: Quem produz/consome cada artefato SDD, autoridade de comando e mapa skill→agente Triviaiox. Puxe ao orquestrar o trabalho (Sinérgica SO).
alwaysApply: false
---

# AGENTS.md — Agentes Triviaiox no Sinérgica SO

O Padrão SO usa os agentes do **Triviaiox** (sem alterar o core dele) para executar a **esteira
SDD**. A regra de ouro: **há um único conjunto de artefatos canônicos** — `product.md`,
`domain.md`, `design.md`, `spec.md`, `tasks.md` + ADR. Não existe "story" como artefato paralelo;
a *story* do Triviaiox é apenas a **visão de execução derivada de `tasks.md`**.

## Modelo de artefato canônico × agente
Cada artefato tem **um dono que produz** e **agentes que consomem**.

| Artefato (`specs/NNNN-*/`) | Responde | Produz (dono) | Consome | Quando |
|---|---|---|---|---|
| `product.md` | por quê / para quem | `@pm` (com `@analyst`) | todos | tier pequeno+ |
| `domain.md` | linguagem e modelo | `@architect` (com `@pm`) | `@dev`, `@qa` | quando há domínio novo |
| `design.md` | como (nível de sistema) | `@architect` | `@dev`, `@data-engineer`, `@qa` | **tier arquitetural** |
| `spec.md` | contrato (AC) | `@pm` | todos (oráculo de teste) | tier pequeno+ |
| `tasks.md` | decomposição + gates | `@sm` | `@dev`, `@qa` | tier pequeno+ |
| ADR (`docs/adr/`) | decisão durável | `@architect` | todos | decisão difícil de reverter |
| migrations/DDL | schema | `@data-engineer` | `@dev` | mudança de banco |

> O `@sm` **não cria um novo formato de story**: ele transforma a `spec.md` (AC) e o `design.md`
> em `tasks.md` — cada task mapeia um `AC-N` e tem um **gate executável**.

## Fluxo canônico (ciclo de uma feature)
```
@analyst/@pm  → product.md + spec.md (clarificar AC, fora-de-escopo)
@architect    → domain.md / design.md / ADR (só no tier que exige)
@sm           → tasks.md (AC → task → gate executável)
@dev          → implementa task a task (1 commit por task), local git só
@qa           → valida cada AC PELO GATE (não por inspeção) + revisão adversarial (tenta quebrar); security gate
@devops       → único que faz git push / abre e faz merge de PR / CI/CD
```
Features de **IA/LLM** acrescentam `@prompt-engineer` (evals, versionamento de prompt, defesa
contra injection) e `@security`/`@qa` aplicam o **OWASP LLM Top 10** — ver `ia/`.

## Autoridade de comando (do Triviaiox — respeitar)
- **`@devops` (Gage) — EXCLUSIVO:** `git push`, `git push --force`, `gh pr create/merge`,
  gestão de MCP, CI/CD, release. Todos os outros são **bloqueados** nestas operações.
- **`@dev` (Dex):** pode `git add/commit/status/branch/checkout/merge` **local**,
  `stash/diff/log`; **não** faz push nem mexe em AC/escopo/título da spec.
- **`@pm` (Morgan):** requirements, escrita de spec, épicos.
- **`@po` (Pax):** validação de story-draft (checklist), priorização de backlog.
- **`@sm` (River):** criação de `tasks.md`/draft a partir de spec/design.
- **`@architect` (Aria):** decisões de arquitetura, seleção de tecnologia, ADR; delega DDL
  detalhado a `@data-engineer`.
- **`@data-engineer` (Dara):** schema, migrations, otimização de query, RLS.

## Mapa skill (esteira SDD) → agente
As skills da esteira ficam em `.claude/skills/` e roteiam para os donos de comando:

| Skill | Faz | Agente |
|---|---|---|
| `/clarificar` | entrevista para afiar spec ambígua (1 pergunta por vez) | `@pm` |
| `/nova-feature` | loop tier → spec → tasks → implementação | `@sm` + `@dev` |
| `/validar` | UAT local: roda gates (AC→teste), checa DoD | `@qa` |
| `/revisao-adversarial` | tenta **quebrar** cada AC (borda, erro, concorrência, abuso) antes do PASS | `@qa` + `@security` |
| `/revisar-pr` | gate de conformidade SDD no PR | `@qa` |
| `/auditar` | valida integridade da esteira (frontmatter, links, rastreabilidade) | `@architect` |
| `/handoff` | pausa/retoma via `docs/STATE.md` | qualquer |

## Quadro completo de agentes (15)
`@triviaiox-master` (orquestra), `@pm`, `@po`, `@sm`, `@analyst`, `@architect`,
`@data-engineer`, `@dev`, `@qa`, `@security`, `@reliability`, `@prompt-engineer`,
`@ux-design-expert`, `@devops`, `@squad-creator`.

## Extensão da Trivia
Os ajustes da Trivia (config, rules, mapa de artefatos) vivem no squad
`squads/trivia-os/` — **nunca** no core do Triviaiox (`.triviaiox-core/`). Ver o README do squad.

## Agentes disponíveis neste repositório
- `.claude/commands/TRIVIAIOX/agents/` — para Claude Code
- `.codex/agents/` — para o Codex
- `.claude/skills/` — 6 skills da esteira SDD
