---
name: tasks
description: Decomposição e gates — Scoring + Clusters.
alwaysApply: false
---

# Tasks — Config de growth: Scoring + Clusters

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `NNNN_E02-S18_atendimento_scoring_clusters.sql` (regras scoring + clusters; RLS FORCE + grant) | AC-1,AC-2,AC-3 | — | `supabase test db` | done |
| 2  | Domínio: cálculo de score por regras + classificação em cluster (precedência) | AC-1,AC-2 | — | test do domínio (score, precedência de cluster) | done |
| 3  | Use-cases + adapter Supabase | AC-1,AC-2 | 1,2 | test do caso de uso/adapter | done |
| 4  | Abas `LeadScoringBehaviorTab` + `ClusterRulesTab` + gating | AC-1,AC-2,AC-3 | 3 | test de componente | done |
| 5  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1–4 | `pnpm run ci:local` | done |

## Plano de teste
- Unidade: cálculo de score, precedência de cluster (borda). Integração: RLS/adapter. Componente: 2 abas. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
