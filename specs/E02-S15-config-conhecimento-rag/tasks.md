---
name: tasks
description: Decomposição e gates — aba Conhecimento / RAG.
alwaysApply: false
---

# Tasks — Aba de config: Conhecimento / Base RAG

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `NNNN_E02-S15_atendimento_conhecimento.sql` (entradas + embedding/pgvector + RLS FORCE + grant) | AC-1, AC-2 | — | `supabase test db` | done |
| 2  | Domínio + use-cases CRUD de entrada | AC-1 | — | test do domínio/caso de uso | done |
| 3  | Recuperação por relevância (RAG): geração de embedding + busca por similaridade, ligada ao toggle de E02-S14 | AC-2 | 1 | test de integração (top-k por similaridade) | done |
| 4  | Adapter Supabase + gateway | AC-1, AC-2 | 1,2 | test do adapter | done |
| 5  | `KnowledgeBaseTab` (nova `TabId`) + contagem de entradas ativas + gating | AC-1, AC-3 | 2,4 | test de componente | done |
| 6  | Migrar o texto free-text por persona para entradas (compat) | AC-1 | 1 | test de migração/backfill | done |
| 7  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1–6 | `pnpm run ci:local` | done |

## Plano de teste
- Unidade: CRUD/validação. Integração: recuperação top-k por relevância (AC-2), RLS. Componente: aba + gating. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
