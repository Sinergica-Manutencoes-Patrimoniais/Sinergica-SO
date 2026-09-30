---
name: auditar
description: Use para checar a integridade da esteira SDD — roda audit-esteira e eval-spec-fidelity e reporta frontmatter/links quebrados, specs sem spec.md e AC sem rastreabilidade. Agente: @architect. Acione com /auditar.
---

# Skill: Auditar (integridade da esteira)

Verifica se a esteira está íntegra. **Dono:** `@architect`. Use periodicamente e antes de releases.

## Passos
1. `npm run audit:esteira` — frontmatter (`name`/`description`/`alwaysApply`), links relativos,
   toda `specs/NNNN-*/` com `spec.md`.
2. `npm run eval:spec` — todo `AC` coberto por task; `SPEC_DEVIATION` contados.
3. `node scripts/validate-mermaid.mjs` — blocos Mermaid válidos.
4. Reporte cada problema com o caminho do arquivo e a correção sugerida.

## Critério
Esteira íntegra = os três comandos saem com exit 0. Qualquer vermelho é bloqueante para release.
