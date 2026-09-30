---
name: feedback-processo-stories
description: Processo por story (owner no ROADMAP, spec+tasks antes de codar). Versão enxuta pós E00-S25.
metadata:
  type: feedback
---

# Processo por story (enxuto)

1. Grep da sua story no `docs/epics/ROADMAP.md` (nunca leia inteiro); marque o **owner antes de codar**.
2. Feature: Spec Kit (`speckit-specify/plan/tasks/implement`) em `specs/E0N-S0N-<nome>/`. Trivial/bug: só branch + PR.
3. Arquitetural: ADR antes + `/revisao-adversarial`.
4. Ao concluir: tire a linha do ROADMAP; `docs/STATE.md` só via `/handoff`.

**Why:** várias sessões (humanas + Claude) em paralelo; sem owner há conflito e perda de rastreio. A versão anterior (6 personas + 14 gates) custava ~80k tokens por sessão só de contexto.

**How to apply:** a cada nova solicitação de feature, verifique o ROADMAP antes de dizer "vou implementar X". `E00-S01` foi feita sem processo (SPEC_DEVIATION): não repetir.
