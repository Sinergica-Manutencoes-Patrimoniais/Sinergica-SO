---
name: tasks
description: Decomposição e gates — base única de contatos.
alwaysApply: false
---

# Tasks — Base Única de Contatos

## Plano
| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Migration `0047`: schema `relacionamento`, tabelas, RLS, RPCs, colunas `contato_id` | AC-1..AC-5 | `lint:migrations` | feito |
| 2 | Migration `0048`: validar FKs adicionadas como `NOT VALID` | AC-1, AC-3 | `lint:migrations` | feito |
| 3 | Atualizar `config.toml` para expor schema `relacionamento` localmente | AC-4 | `ci:local` | feito |
| 4 | `pcm-ze-agent`: criar lead com `contato_id` da conversa | AC-3 | `typecheck` | feito |
| 5 | pgTAP `relacionamento_contatos_timeline.test.sql` | AC-1..AC-5 | `supabase test db` no CI | feito |
| 6 | Atualizar ROADMAP/STATE/ADR | — | `audit:esteira` | feito |

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [x] AC-1 a AC-5 implementados em código local
- [x] Gates locais verdes: `ci:local` (216 pass/9 skip), `lint:migrations`, `lint`, `typecheck`,
  `test`, `build`, `arch:check`, `audit:esteira`, `eval:spec`
- [ ] pgTAP executado em Postgres real/CI
