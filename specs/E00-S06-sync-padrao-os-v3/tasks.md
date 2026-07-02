---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Sincronizar correções do Padrão OS v3 / Triviaiox

## Plano
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)                                               | Status |
|----|-----------------------------------------------------------------------|----------|------------|----------------------------------------------------------------|--------|
| 1  | Substituir `@github-devops` → `@devops` nos 6 wrappers Claude Code    | AC-1     | —          | `grep -rL "@github-devops\|agent != \\\"github-devops\\\"" .claude/commands/TRIVIAIOX/agents/*.md` sem resultado | done   |
| 2  | Copiar hook `enforce-git-push-authority.sh` para `.claude/hooks/`     | AC-2     | —          | `test -x .claude/hooks/enforce-git-push-authority.sh`           | bloqueado |
| 3  | Mesclar `PreToolUse.Bash` no `.claude/settings.json` sem remover o hook `Edit\|Write` existente | AC-2 | 2 | payload de teste `git push` → `permissionDecision: deny`; payload `pnpm test` → sem output (allow) | bloqueado |
| 4  | Criar `.dependency-cruiser.cjs` adaptado a `apps/web/src/features/*` | AC-3     | —          | `pnpm exec depcruise apps/web/src --config .dependency-cruiser.cjs` | done |
| 5  | Adicionar `dependency-cruiser` como devDependency + script `arch:check` (raiz) `[P]` | AC-3 | 4 | `pnpm run arch:check` | done |
| 6  | Adicionar step `arch:check` no `.github/workflows/ci.yml`             | AC-3     | 5          | inspeção do workflow (roda no job `qualidade`)                  | done   |
| 7  | Atualizar `PADRAO-DE-QUALIDADE.md` (item 11 → 🟢 Gate CI) e `Definition-of-Done.md` (linha do gate) `[P]` | AC-3 | 5 | inspeção                                                        | done   |
| 8  | Trocar `gitleaks-action@v2` pela CLI no `ci.yml`                       | AC-4     | —          | inspeção (YAML válido; org repo não depende de `GITLEAKS_LICENSE`) | done |
| 9  | Criar `.github/workflows/deploy.yml` adaptado (sem `db/migrations/`, só `supabase/**`) | AC-5 | — | YAML parseia (`js-yaml`); revisão manual dos secrets referenciados | done |
| 10 | Atualizar `docs/ENVIRONMENTS.md` (promoção automática) e `PADRAO-DE-QUALIDADE.md` (item 7a) `[P]` | AC-5 | 9 | inspeção | done |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto 6/7, que são
> documentação/CI e verificadas por leitura, já que não há runner de CI local neste ambiente).

## Plano de teste
- AC-1: grep de regressão (task 1) — zero ocorrências de referência de persona a `github-devops`.
- AC-2: invocação manual do hook com dois payloads JSON (`git push origin main` → deny; comando
  inofensivo → allow/sem saída).
- AC-3: `pnpm run arch:check` roda limpo no estado atual do repo (nenhuma violação hoje) e falha
  se um import de teste violar a regra (validado manualmente, revertido antes do commit).

## Divergências (SPEC_DEVIATION)
- **Task 2/3 (AC-2) · bloqueado pelo classificador de auto-modo do Claude Code**: escrever em
  `.claude/hooks/` e mesclar `.claude/settings.json` mexe no mecanismo que controla as próprias
  permissões da sessão (self-modification) — o classificador exige confirmação explícita e
  nomeada do usuário, não coberta por "ajuste tudo" genérico. O arquivo do hook foi criado
  (`.claude/hooks/enforce-git-push-authority.sh`, conteúdo idêntico ao squad `trivia-os`) mas
  **sem `chmod +x`** e **sem estar wired no `.claude/settings.json`** — ou seja, inerte. Resolução:
  aguardando confirmação explícita do usuário para os 2 passos finais (chmod +x + merge do
  `PreToolUse.Bash`).

## Checklist de Definition of Done
- [x] Todos os AC verdes **pelo gate executável** (exceto AC-2 — ver divergência acima)
- [x] `SPEC_DEVIATION` documentada acima (AC-2)
- [x] ADRs de decisões difíceis de reverter registrados (N/A — correção mecânica)
- [x] Glossário atualizado se mudou (N/A — sem termo novo)
- [x] Spec reflete o que foi construído
- [x] `docs/STATE.md` atualizado
