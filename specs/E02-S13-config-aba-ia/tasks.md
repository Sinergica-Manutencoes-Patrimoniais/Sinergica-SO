---
name: tasks
description: Decomposição e gates — aba de config IA.
alwaysApply: false
---

# Tasks — Aba de config: IA

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Tipo/regras da config IA em `domain/` (validação de modelo, janela) | AC-1, AC-2 | — | test do domínio | done |
| 2  | Migration `NNNN_E02-S13_atendimento_config_ia.sql` (tabela + RLS FORCE + grant service_role) | AC-1, AC-3 | — | `supabase test db` (RLS) | done |
| 3  | Use-cases `buscar/salvar-config-ia` + porta em `application/` | AC-1, AC-2 | 1 | test do caso de uso | done |
| 4  | Adapter Supabase | AC-1 | 2,3 | test do adapter | done |
| 5  | `AISettingsTab` (nova `TabId` em `AtendimentoConfigPage.tsx`) + gating por papel | AC-1,AC-2,AC-3 | 3,4 | test de componente | done |
| 6  | `pnpm run ci:local` + paridade com heziomos + ROADMAP/STATE | todos | 1–5 | `pnpm run ci:local` | done |

## Plano de teste
- Unidade: validação de modelo/janela. Integração: adapter/RLS. Componente: aba + gating. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
