# Tasks — E00-S25

- [x] T1 (F0) Tag `pre-enxugamento` + branch `chore/E00-S25-workflow-enxuto` — AC-2
- [x] T2 (F1) `scripts/roadmap-compactar.mjs` + histórico verbatim + ROADMAP compacto — AC-1, AC-2
- [x] T3 (F1) `CLAUDE.md` 179 → 60 linhas; memórias `.claude/memory` atualizadas — AC-1
- [x] T4 (F1) `settings.json`: remove hook `check-story`, troca hook de push por `permissions.ask` — AC-3
- [x] T5 (F1) `nova-story.mjs` para ROADMAP compacto — AC-7
- [x] T6 (F2) `lefthook.yml`: pre-push só afetados (+ hook `ci` completo); checks SDD/design movidos para a CI (`ci.yml`) — AC-4
- [x] T7 (F2) CI ganha gates de design, `biome check .` e build affected (antes só rodavam no pre-push). SPEC_DEVIATION: NÃO unificamos os 9 `check-*.mjs` nem tiramos o `tsc` do build web (risco/custo > ganho: agora só rodam na CI; `tsc` no build protege o deploy Netlify) — AC-5
- [x] T8 (F2) `audit-esteira` ignora `.specify`/`historico` e não exige frontmatter em `specs/`; `eval:spec` avalia specs E0N-S0N tocadas vs origin/main e não concatena o repo em string — AC-5
- [x] T9 (F2) `Definition-of-Done.md` reescrito (61 → 32 linhas; segurança/perf/observabilidade preservadas) — AC-5
- [x] T10 (F3) Spec Kit core copiado do Atendimento (`.specify/`, 5 skills); constitution Sinérgica; pasta `E0N-S0N-nome` via `SPECIFY_FEATURE_DIRECTORY` (o skill já suporta, sem patch); templates ganham convenção AC-N — AC-6
- [x] T11 (F3) Skill `revisao-adversarial`; `nova-feature`/`validar`/`revisar-pr`/`auditar` em `docs/_arquivo/skills/` — AC-6
- [x] T12 (F4) `AGENTS.md` 92 → 39 linhas, personas opcionais. SPEC_DEVIATION: ANTI-PADROES/PADRAO-DE-QUALIDADE NÃO arquivados (10 arquivos linkam para eles; custo zero quando não lidos) — AC-1
- [x] T13 (F4) ADR-0023 `docs/adr/0023-workflow-enxuto-spec-kit.md` — AC-6
