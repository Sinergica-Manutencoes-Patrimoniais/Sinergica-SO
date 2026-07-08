---
name: tasks
description: Decomposição e gates — automação Coment. IG + Opt-outs.
alwaysApply: false
---

# Tasks — Config de automação: Comentários IG + Opt-outs

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `NNNN_E02-S17_atendimento_automacao.sql` (regras IG + opt-outs; RLS FORCE + grant) | AC-1,AC-2,AC-3 | — | `supabase test db` | done |
| 2  | Domínio + use-cases: CRUD regra IG, add/remover opt-out, checagem de opt-out antes de envio | AC-1,AC-2 | — | test do domínio/caso de uso | done |
| 3  | Adapter Supabase | AC-1,AC-2 | 1,2 | test do adapter | done |
| 4  | Abas `IgCommentAutomationsTab` + `FlowOptoutsTab` + gating | AC-1,AC-2,AC-3 | 2,3 | test de componente | done |
| 5  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1–4 | `pnpm run ci:local` | done |

## Plano de teste
- Unidade: validação de regra, checagem de opt-out. Integração: RLS/adapter. Componente: 2 abas. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
