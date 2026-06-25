# AGENTS.md - TriviaGrowth Triviaiox (Codex CLI)

Este arquivo define as instrucoes do projeto para o Codex CLI.

<!-- TRIVIAIOX-MANAGED-START: core -->
## Core Rules

1. Siga a Constitution em `.triviaiox-core/constitution.md`
2. Priorize `CLI First -> Observability Second -> UI Third`
3. Trabalhe por stories em `docs/stories/`
4. Nao invente requisitos fora dos artefatos existentes
<!-- TRIVIAIOX-MANAGED-END: core -->

<!-- TRIVIAIOX-MANAGED-START: quality -->
## Quality Gates

- Rode `npm run lint`
- Rode `npm run typecheck`
- Rode `npm test`
- Atualize checklist e file list da story antes de concluir
<!-- TRIVIAIOX-MANAGED-END: quality -->

<!-- TRIVIAIOX-MANAGED-START: codebase -->
## Project Map

- Core framework: `.triviaiox-core/`
- CLI entrypoints: `bin/`
- Shared packages: `packages/`
- Tests: `tests/`
- Docs: `docs/`
<!-- TRIVIAIOX-MANAGED-END: codebase -->

<!-- TRIVIAIOX-MANAGED-START: commands -->
## Common Commands

- `npm run sync:ide`
- `npm run sync:ide:check`
- `npm run sync:skills:codex`
- `npm run sync:skills:codex:global` (opcional; neste repo o padrao e local-first)
- `npm run validate:structure`
- `npm run validate:agents`
<!-- TRIVIAIOX-MANAGED-END: commands -->

<!-- TRIVIAIOX-MANAGED-START: shortcuts -->
## Agent Shortcuts

Preferencia de ativacao no Codex CLI:
1. Use `/skills` e selecione `triviaiox-<agent-id>` vindo de `.codex/skills` (ex.: `triviaiox-architect`)
2. Se preferir, use os atalhos abaixo (`@architect`, `/architect`, etc.)

Interprete os atalhos abaixo carregando o arquivo correspondente em `.triviaiox-core/development/agents/` (fallback: `.codex/agents/`), renderize o greeting via `generate-greeting.js` e assuma a persona ate `*exit`:

- `@architect`, `/architect`, `/architect.md` -> `.triviaiox-core/development/agents/architect.md`
- `@dev`, `/dev`, `/dev.md` -> `.triviaiox-core/development/agents/dev.md`
- `@qa`, `/qa`, `/qa.md` -> `.triviaiox-core/development/agents/qa.md`
- `@pm`, `/pm`, `/pm.md` -> `.triviaiox-core/development/agents/pm.md`
- `@po`, `/po`, `/po.md` -> `.triviaiox-core/development/agents/po.md`
- `@sm`, `/sm`, `/sm.md` -> `.triviaiox-core/development/agents/sm.md`
- `@analyst`, `/analyst`, `/analyst.md` -> `.triviaiox-core/development/agents/analyst.md`
- `@devops`, `/devops`, `/devops.md` -> `.triviaiox-core/development/agents/devops.md`
- `@data-engineer`, `/data-engineer`, `/data-engineer.md` -> `.triviaiox-core/development/agents/data-engineer.md`
- `@ux-design-expert`, `/ux-design-expert`, `/ux-design-expert.md` -> `.triviaiox-core/development/agents/ux-design-expert.md`
- `@squad-creator`, `/squad-creator`, `/squad-creator.md` -> `.triviaiox-core/development/agents/squad-creator.md`
- `@triviaiox-master`, `/triviaiox-master`, `/triviaiox-master.md` -> `.triviaiox-core/development/agents/triviaiox-master.md`
<!-- TRIVIAIOX-MANAGED-END: shortcuts -->
