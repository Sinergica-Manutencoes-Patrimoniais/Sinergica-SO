---
name: tasks
description: Decomposição e gates de E00-S28. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E00-S28 · Ativação visível no front

Detalhe técnico (assinaturas, contratos, lotes) em `plan.md`. Uma linha por task.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Inventariar as 737 flags lidas e gerar `FLAGS_SSO` inicial (nome, padrão `false`, jornada, gate par) | AC-3 | — | `node scripts/check-flags-declaradas.mjs --inventario` lista 737 e 0 sem jornada | todo |
| 2 | `config/flags-sso.ts` + `flags-sso.test.ts` — registro tipado e `flagLigada` como único leitor de `import.meta.env` | AC-3 | 1 | `cd apps/web && pnpm vitest run src/config/flags-sso.test.ts` | todo |
| 3 | `env.ts` valida o registro na inicialização (fail-fast, padrão da casa) | AC-3 | 2 | `cd apps/web && pnpm vitest run src/config/env.test.ts` | todo |
| 4 | `packages/ui/RecursoNaoAtivado.tsx` + teste — detalhe por papel, nunca `null` | AC-4, AC-5, AC-6 | — | `cd apps/web && pnpm vitest run packages/ui/src/RecursoNaoAtivado.test.tsx` | todo |
| 5 | `scripts/check-flags-declaradas.mjs` + `.test.mjs` — as 4 condições de falha do `plan.md` | AC-1, AC-2 | 2 | `node --test scripts/check-flags-declaradas.test.mjs` | todo |
| 6 | Traduzir `42501` × `55000` em `lib/http/problem.ts` + teste | AC-7 | 4 | `cd apps/web && pnpm vitest run src/lib/http/problem.test.ts` | todo |
| 7 | `codemod-flags-registro.mjs` — migra leitura direta para `flagLigada`, idempotente | AC-1 | 2, 5 | `node scripts/codemod-flags-registro.mjs --dry-run` sem diff inesperado | todo |
| 8 | **Lote 1** `features/pcm/interfaces/chamados-os/` — inclui trocar o `return null` de `CriarOsChamado.tsx:19` | AC-4 | 4, 6, 7 | `node scripts/check-flags-declaradas.mjs --dir apps/web/src/features/pcm/interfaces/chamados-os` | todo |
| 9 | **Lote 2** resto de `features/pcm/` | AC-4 | 8 | `... --dir apps/web/src/features/pcm` | todo |
| 10 | **Lote 3** `features/area-cliente/` — revisão `@security` do que o síndico vê | AC-6 | 8 | `... --dir apps/web/src/features/area-cliente` + revisão humana | todo |
| 11 | **Lote 4** `features/financeiro/` + `features/comercial/` | AC-4 | 8 | `... --dir` nos dois | todo |
| 12 | **Lote 5** `features/atendimento/` + `features/config/` | AC-4 | 8 | `... --dir` nos dois | todo |
| 13 | **Lote 6** `app/` e remanescentes | AC-4 | 9–12 | `node scripts/check-flags-declaradas.mjs` (repositório inteiro) | todo |
| 14 | Ligar `flags-declaradas` no laço de gates do `ci.yml:104` | AC-1, AC-2 | 13 | `gh pr checks` com o job `qualidade` verde | todo |
| 15 | Inventário publicado flag × leitor × gate × jornada × estado servido | AC-8, AC-9 | 2, 13 | `node scripts/check-flags-declaradas.mjs --inventario > docs/ativacao/flags.md` versionado | todo |
| 16 | Linha de ativação no PR: o que falta para cada jornada tocada | AC-F5 | 13 | revisão humana | todo |

## Definition of Done

- `node scripts/check-flags-declaradas.mjs` sai 0 no repositório inteiro (SC-001).
- Zero `return null` silencioso atrás de flag nos caminhos de ação do PCM (SC-002).
- Um administrador descobre o que falta sem abrir o código (SC-003).
- Nenhuma mensagem expõe nome de flag ou gate a perfil não administrativo (SC-004).
- CI verde no PR, `db-tests` não pulado.
- **Nenhum gate de banco aberto por esta story.**
