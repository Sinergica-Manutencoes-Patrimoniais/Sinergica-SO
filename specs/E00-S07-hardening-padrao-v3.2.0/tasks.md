---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Hardening pós-primeira-pipeline-real (Padrão OS v3.2.0 → v3.4.0)

> **Nota:** o padrão evoluiu de v3.2.0 para v3.3.0/v3.3.1/v3.4.0 **no meio desta mesma story**
> (infra caseira → Lefthook/Squawk; revisão adversarial). Tasks 1-15 abaixo eram o plano original
> (v3.2.0); tasks 16+ cobrem a atualização real aplicada (v3.3.0→v3.4.0). Não reabri a spec para
> reescrever do zero — documentado aqui como o trabalho de fato evoluiu.

## Plano (v3.2.0 — parcialmente superado)
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)                                               | Status |
|----|-----------------------------------------------------------------------|----------|------------|----------------------------------------------------------------|--------|
| 1  | Trazer `scripts/lint-migrations.mjs` (DROP+GRANT) do scaffold         | AC-2     | —          | `pnpm run lint:migrations`                                     | done |
| 2  | Rodar o lint e corrigir migrations reais que acusar                   | AC-2     | 1          | `pnpm run lint:migrations` limpo                                | done (achou GRANT ausente em `audit.events` — migration `0003` nova) |
| 3  | Trocar o job `migrations` do `ci.yml` pelo script novo `[P]`          | AC-2     | 1,2        | inspeção YAML                                                   | done |
| 4  | Trazer `scripts/ci-local.mjs`, adaptado a pnpm/turbo/build automático | AC-1     | 1          | `pnpm run ci:local`                                             | **superado** — v3.3.0 substituiu `ci-local.mjs` por Lefthook (task 17) |
| 5  | Adicionar `lint:migrations`/`ci:local` ao `package.json` raiz `[P]`   | AC-1,2   | 1,4        | scripts presentes                                                | done |
| 6  | Trocar `.husky/pre-push` para `pnpm run ci:local`                     | AC-1     | 4,5        | inspeção + push de teste (dry, sem enviar)                      | **superado** — `.husky/` removido, ver task 17 |
| 7  | Adicionar `validate-mermaid.mjs` como step novo no `ci.yml` `[P]`     | AC-1     | —          | inspeção YAML (paridade ci-local ↔ ci.yml)                      | done |
| 8  | Reconciliar `.gitignore` (sbom.json, binário `gitleaks`) `[P]`        | AC-3     | —          | inspeção                                                         | done |
| 9  | Reconciliar `.gitleaks.toml` (regexes de exemplo/placeholder) `[P]`   | AC-3     | —          | `gitleaks detect` local limpo                                    | done (só o path `.triviaiox/` — `regexes` de exemplo NÃO trazidos, ver Divergências) |
| 10 | Atualizar `db/rls.template.sql` com passo de GRANT obrigatório `[P]`  | AC-4     | —          | inspeção                                                         | done |
| 11 | Atualizar `db/rls-test.md` com a pegadinha do `throws_ok` `[P]`       | AC-4     | —          | inspeção                                                         | done |
| 12 | Atualizar skills `validar`/`revisar-pr` (exigir `gh pr checks`) `[P]` | AC-4     | —          | inspeção                                                         | done |
| 13 | Atualizar `Definition-of-Done.md` (tabela de gates + `ci:local`) `[P]`| AC-4     | 4,5        | inspeção                                                         | done |
| 14 | Confirmar `engines.node`/Node da CI/versões já alinhadas (E00-S06)    | AC-5     | —          | leitura — sem mudança se já correto                             | done |
| 15 | `pnpm install` + `pnpm run ci:local` de ponta a ponta                 | AC-6     | 1-14       | `pnpm run ci:local` verde                                       | done (ver task 21) |

## Plano (v3.3.0/v3.3.1/v3.4.0 — trabalho real, achado ao ler o vault na task 14)
| #  | Task | Depende de | Gate | Status |
|----|------|------------|------|--------|
| 16 | Remover `.husky/`, `.lintstagedrc.json`, `scripts/ci-local.mjs` | — | `git rm` | done |
| 17 | Criar `lefthook.yml` (pre-commit/commit-msg/pre-push, paralelo), adaptado a pnpm | 16 | `pnpm run ci:local` (= `lefthook run pre-push`) | done |
| 18 | `package.json`: `prepare` = `lefthook install`; trocar husky/lint-staged por `lefthook` devDependency | 17 | `pnpm install` sem erro | done |
| 19 | Squawk: `.squawk.toml` + `squawk-cli` devDependency + `squawk-action` no `ci.yml`; enxugar `lint-migrations.mjs` (RLS-GRANT continua custom, mantendo minha correção cross-file/regex) | 17 | `pnpm run lint:migrations` roda Squawk | done |
| 20 | Achado real do Squawk: 8 avisos (timeout settings, prefer-bigint) só em `0001`/`0002`, já aplicadas — excluídos via `excluded_rules` **top-level** (achado: dentro de `[default]` o Squawk ignora silenciosamente), com justificativa e critério de reavaliação | 19 | `pnpm run lint:migrations` 0 issues | done |
| 21 | `git config --unset-all --local core.hooksPath` (resíduo do husky bloqueava o Lefthook) | 17 | `lefthook install` sem erro | done |
| 22 | Atualizar `/validar`, `/revisar-pr`, `Definition-of-Done.md`, `PADRAO-DE-QUALIDADE.md`, `AGENTS.md`, `CLAUDE.md`, `README.md` para v3.3.0→v3.4.0 (Lefthook, Squawk, revisão adversarial, `gh pr checks` real) | 17,19 | inspeção + `audit:esteira` | done |
| 23 | Corrigir "Padrão SO v2" stale (mesma classe de bug do v3.3.1 do vault) em `CLAUDE.md`×2, `README.md` (`package.json` já corrigido) | — | `grep -rn "Padrão SO v2"` vazio | done |
| 24 | Criar `.claude/skills/revisao-adversarial/SKILL.md` | — | — | **bloqueado** — ver Divergências |
| 25 | `pnpm install` + `pnpm run ci:local` de ponta a ponta (final, pós-Lefthook) | 16-23 | `pnpm run ci:local` verde | done |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde marcado
> "inspeção", que são docs/YAML sem runner local equivalente).

## Plano de teste
- `pnpm run ci:local` de ponta a ponta, verde (mermaid, fidelidade, esteira, lint, migrations,
  arquitetura, testes, typecheck, build — gitleaks pulado por condição, binário ausente local).
- `pnpm run lint:migrations`: limpo nas 3 migrations reais (`0001`, `0002`, `0003`); testado que
  pega violação real (policy sem GRANT injetada e revertida) e que Squawk pega achado real
  (8 avisos antes de excluir as 2 regras justificadas).

## Divergências (SPEC_DEVIATION)
- **Task 9 (AC-3):** os `regexes` de allowlist extra do scaffold (`EXAMPLE`, `your-api-key-here`,
  `VITE_SUPABASE_ANON_KEY`) **não foram trazidos** — o classificador de auto-modo bloqueou por
  enfraquecer o gate de secret scanning além do que foi confirmado com o usuário (que só pediu
  para confirmar/manter o allowlist de `.triviaiox-core/` já existente). Path `.triviaiox/`
  mantido (mesma categoria já aprovada). Resolução: aguardando o usuário decidir se quer os
  regexes extra numa próxima rodada.
- **Task 24:** criar a skill `/revisao-adversarial` foi bloqueado pelo classificador — arquivo
  novo em `.claude/skills/` define comportamento padrão futuro, e o mandato geral desta tarefa
  ("ajuste todo o projeto, deixe ele 100%") não foi julgado específico o suficiente para essa
  ação em particular (diferente de *editar* skills existentes, que foi permitido). `/validar`,
  `/revisar-pr`, `Definition-of-Done.md`, `PADRAO-DE-QUALIDADE.md` e `AGENTS.md` já **referenciam**
  `/revisao-adversarial` — falta só o arquivo da skill em si. Conteúdo completo (copiado do
  scaffold, sem adaptação necessária — é genérico) fica pronto para o usuário aprovar a criação.

## Checklist de Definition of Done
- [x] Todos os AC verdes **pelo gate executável** (exceto a criação da skill nova, ver Divergências)
- [x] `SPEC_DEVIATION` documentada acima (2 itens, ambos bloqueios do classificador de auto-modo)
- [x] ADRs de decisões difíceis de reverter registrados (N/A — correção mecânica)
- [x] Glossário atualizado se mudou (N/A — sem termo novo)
- [x] Spec reflete o que foi construído
- [x] `docs/STATE.md` atualizado
- [x] **Sem push/merge** — commits locais só, usuário decide quando abrir PR (instrução explícita)
