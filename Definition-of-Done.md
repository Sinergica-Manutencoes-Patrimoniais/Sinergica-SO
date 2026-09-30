# Definition of Done — Padrão OS

> Pronto = **gates executáveis passam**, não inspeção visual. A **CI é o gate definitivo**;
> o pre-push local é só feedback rápido.

## Gates
| Momento | O que roda | Comando |
|---------|-----------|---------|
| `pre-commit` | Biome nos arquivos staged | automático (Lefthook) |
| `commit-msg` | Conventional Commits com `E0N-S0N` no escopo | automático |
| `pre-push` | lint dos arquivos do push + typecheck/test **só dos pacotes afetados** vs `origin/main` + gitleaks; migrations/edge-functions só se tocadas | automático (`git fetch` antes) |
| completo, sob demanda | espelho da CI (esteira, fidelidade spec, mermaid, 9 gates de design, arch, build, testes de tudo) | `pnpm run ci:local` (= `lefthook run ci`) — antes de PR sensível |
| CI (`qualidade`, `migrations`, `db-tests`) | tudo acima + Squawk + `pnpm audit` + deno + **pgTAP/RLS** | `gh pr checks` |

`db-tests` (pgTAP/RLS, exige Docker) só roda na CI: **não pode ter sido silenciosamente pulado**.
Emergência: `git push --no-verify` (registre o porquê; a CI ainda cobra). `git push` sempre pede confirmação (`permissions.ask`).

## Checklist do PR
- [ ] Todo `AC` da `spec.md` **verde por comando** (`pnpm test`), não por inspeção.
- [ ] `gh pr checks` verde, sem check obrigatório pulado (`db-tests` incluído).
- [ ] Sem `SPEC_DEVIATION` pendente; `spec.md` reflete o que foi construído.
- [ ] Decisão difícil de reverter virou **ADR** em `docs/adr/`.
- [ ] **Segurança / performance / observabilidade:**
  - sem secret no client; input validado (Zod); JWT validado; RLS FORCE + pgTAP na tabela nova (dívida aceita → `docs/SECURITY_DEBT.md`);
  - query crítica indexada (sem `Seq Scan` em tabela grande), lista paginada, sem N+1 (`performance/README.md`);
  - erro na borda em `problem+json` com `reqId`; log estruturado sem PII.
- [ ] Feature de IA/LLM: checks da trilha `ia/` (evals, prompt versionado, injection).
- [ ] Glossário atualizado se criou termo; linha da story tirada do ROADMAP ao concluir.
- [ ] **Tier arquitetural:** `/revisao-adversarial` feita (borda, erro parcial, concorrência, abuso, buraco na spec); achado reproduzido virou teste.

## Web Vitals (quando houver frontend)
LCP < 2.5s · INP < 200ms · CLS < 0.1
