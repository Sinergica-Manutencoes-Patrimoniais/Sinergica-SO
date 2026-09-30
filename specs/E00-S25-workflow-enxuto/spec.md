---
name: E00-S25-workflow-enxuto
description: Enxugar workflow (contexto, gates, personas) mantendo rastreio E0N-S0N, segurança OS-grade e specs. Plano completo em plan.md.
---

# E00-S25 — Workflow enxuto

**Objetivo:** reduzir tokens e tempo por story sem perder rastreio, specs, segurança e performance.
**Fora de escopo:** reescrever specs legadas; deletar `.triviaiox-core/`, `.claude/commands/TRIVIAIOX/`, `.codex/agents/`; mexer em RLS/pgTAP/Squawk/gitleaks/`pnpm audit` na CI.

## AC
- **AC-1** Given sessão nova, When carrega contexto base, Then `CLAUDE.md` + `docs/STATE.md` somam ≤ 20 KB e o `ROADMAP.md` ≤ 40 KB (antes: ~300 KB).
- **AC-2** Given `docs/epics/historico/ROADMAP-ate-2026-09.md`, When comparado ao ROADMAP anterior (`git show pre-enxugamento:docs/epics/ROADMAP.md`), Then é idêntico byte a byte.
- **AC-3** Given `git push`, When executado por agente, Then continua pedindo confirmação (`permissions.ask`).
- **AC-4** Given diff pequeno, When `lefthook run pre-push`, Then roda só lint/typecheck/test dos pacotes afetados + gitleaks.
- **AC-5** Given PR, When CI roda, Then `qualidade`, `migrations` e `db-tests` (pgTAP/RLS) executam e passam, sem check obrigatório pulado.
- **AC-6** Given story nova, When segue o fluxo, Then usa `speckit-*` em `specs/E0N-S0N-<nome>/` e `/revisao-adversarial` existe como skill.
- **AC-7** Given `scripts/nova-story.mjs`, When registra story, Then insere linha de 5 colunas no ROADMAP compacto.

Plano detalhado (fases F0–F4), diagnóstico e verificação: [plan.md](plan.md).
