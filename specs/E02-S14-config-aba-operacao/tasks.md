---
name: tasks
description: Decomposição e gates — aba de config Operação.
alwaysApply: false
---

# Tasks — Aba de config: Operação

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Domínio: estado dos motores + regra de dependência (Modo vendas ⇒ Ferramentas) | AC-1 | — | test do domínio | done |
| 2  | Migration `NNNN_E02-S14_atendimento_operacao.sql` (motores + regras + orçamento + lições + especialistas; RLS FORCE + grant) | AC-1,AC-2,AC-3,AC-4 | — | `supabase test db` | done |
| 3  | Use-cases + porta (salvar/buscar operação, regras, orçamento, lições, especialistas) | AC-1,AC-2,AC-3 | 1 | test do caso de uso | done |
| 4  | Adapter Supabase | AC-1,AC-2,AC-3 | 2,3 | test do adapter | done |
| 5  | `AgentOperationTab`: toggles + sub-cards `Regras`/`Orçamento`/`Lições`/`Especialistas` + gating | AC-1,AC-2,AC-3,AC-4 | 3,4 | test de componente (dependência de toggle) | done |
| 6  | `pnpm run ci:local` + paridade heziomos + ROADMAP/STATE | todos | 1–5 | `pnpm run ci:local` | done |

## Plano de teste
- Unidade: dependência Modo vendas⇒Ferramentas (matriz). Integração: RLS/adapter. Componente: toggles + sub-cards. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
