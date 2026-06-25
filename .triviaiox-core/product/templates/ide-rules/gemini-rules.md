# Gemini Rules - TriviaGrowth Triviaiox

Este arquivo define as instrucoes do projeto para Gemini CLI neste repositorio.

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

<!-- TRIVIAIOX-MANAGED-START: gemini-integration -->
## Gemini Integration

Fonte de verdade de agentes:
- Canonico: `.triviaiox-core/development/agents/*.md`
- Espelhado para Gemini: `.gemini/rules/TRIVIAIOX/agents/*.md`

Hooks e settings:
- Hooks locais: `.gemini/hooks/`
- Settings locais: `.gemini/settings.json`

Sempre que houver drift, execute:
- `npm run sync:ide:gemini`
- `npm run validate:gemini-sync`
- `npm run validate:gemini-integration`
<!-- TRIVIAIOX-MANAGED-END: gemini-integration -->

<!-- TRIVIAIOX-MANAGED-START: parity -->
## Multi-IDE Parity

Para garantir paridade entre Claude Code, Codex e Gemini:
- `npm run validate:parity`
- `npm run validate:paths`
<!-- TRIVIAIOX-MANAGED-END: parity -->

<!-- TRIVIAIOX-MANAGED-START: activation -->
## Agent Activation

Preferencia de ativacao:
1. Use agentes em `.gemini/rules/TRIVIAIOX/agents/`
2. Se necessario, use fonte canonica em `.triviaiox-core/development/agents/`

Ao ativar agente:
- carregar definicao completa do agente
- renderizar greeting via `node .triviaiox-core/development/scripts/generate-greeting.js <agent-id>`
- manter persona ativa ate `*exit`

Atalhos recomendados no Gemini:
- `/triviaiox-menu` para listar agentes
- `/triviaiox-<agent-id>` (ex.: `/triviaiox-dev`, `/triviaiox-architect`)
- `/triviaiox-agent <agent-id>` para launcher generico
<!-- TRIVIAIOX-MANAGED-END: activation -->

<!-- TRIVIAIOX-MANAGED-START: commands -->
## Common Commands

- `npm run sync:ide`
- `npm run sync:ide:check`
- `npm run sync:ide:gemini`
- `npm run validate:gemini-sync`
- `npm run validate:gemini-integration`
- `npm run validate:parity`
- `npm run validate:structure`
- `npm run validate:agents`
<!-- TRIVIAIOX-MANAGED-END: commands -->
