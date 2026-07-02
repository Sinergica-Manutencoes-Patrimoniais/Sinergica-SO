---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Hardening pós-primeira-pipeline-real (Padrão OS v3.2.0)

## Plano
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)                                               | Status |
|----|-----------------------------------------------------------------------|----------|------------|----------------------------------------------------------------|--------|
| 1  | Trazer `scripts/lint-migrations.mjs` (DROP+GRANT) do scaffold         | AC-2     | —          | `pnpm run lint:migrations`                                     | todo |
| 2  | Rodar o lint e corrigir migrations reais que acusar                   | AC-2     | 1          | `pnpm run lint:migrations` limpo                                | todo |
| 3  | Trocar o job `migrations` do `ci.yml` pelo script novo `[P]`          | AC-2     | 1,2        | inspeção YAML                                                   | todo |
| 4  | Trazer `scripts/ci-local.mjs`, adaptado a pnpm/turbo/build automático | AC-1     | 1          | `pnpm run ci:local`                                             | todo |
| 5  | Adicionar `lint:migrations`/`ci:local` ao `package.json` raiz `[P]`   | AC-1,2   | 1,4        | scripts presentes                                                | todo |
| 6  | Trocar `.husky/pre-push` para `pnpm run ci:local`                     | AC-1     | 4,5        | inspeção + push de teste (dry, sem enviar)                      | todo |
| 7  | Adicionar `validate-mermaid.mjs` como step novo no `ci.yml` `[P]`     | AC-1     | —          | inspeção YAML (paridade ci-local ↔ ci.yml)                      | todo |
| 8  | Reconciliar `.gitignore` (sbom.json, binário `gitleaks`) `[P]`        | AC-3     | —          | inspeção                                                         | todo |
| 9  | Reconciliar `.gitleaks.toml` (regexes de exemplo/placeholder) `[P]`   | AC-3     | —          | `gitleaks detect` local limpo                                    | todo |
| 10 | Atualizar `db/rls.template.sql` com passo de GRANT obrigatório `[P]`  | AC-4     | —          | inspeção                                                         | todo |
| 11 | Atualizar `db/rls-test.md` com a pegadinha do `throws_ok` `[P]`       | AC-4     | —          | inspeção                                                         | todo |
| 12 | Atualizar skills `validar`/`revisar-pr` (exigir `gh pr checks`) `[P]` | AC-4     | —          | inspeção                                                         | todo |
| 13 | Atualizar `Definition-of-Done.md` (tabela de gates + `ci:local`) `[P]`| AC-4     | 4,5        | inspeção                                                         | todo |
| 14 | Confirmar `engines.node`/Node da CI/versões já alinhadas (E00-S06)    | AC-5     | —          | leitura — sem mudança se já correto                             | todo |
| 15 | `pnpm install` + `pnpm run ci:local` de ponta a ponta                 | AC-6     | 1-14       | `pnpm run ci:local` verde                                       | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde marcado
> "inspeção", que são docs/YAML sem runner local equivalente).

## Plano de teste
- AC-1/AC-6: `pnpm run ci:local` de ponta a ponta, verde.
- AC-2: `pnpm run lint:migrations` limpo nas 2 migrations reais; teste manual injetando um
  `CREATE POLICY` sem `GRANT` num arquivo descartável para confirmar que o lint pega (revertido
  antes do commit).
- AC-3: `gitleaks detect --source . --no-banner --redact --exit-code 1` local limpo.

## Divergências (SPEC_DEVIATION)
- Nenhuma até o momento.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADRs de decisões difíceis de reverter registrados (N/A — correção mecânica)
- [ ] Glossário atualizado se mudou (N/A — sem termo novo)
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
- [ ] **Sem push/merge** — commits locais só, usuário decide quando abrir PR (instrução explícita)
