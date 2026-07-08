---
name: tasks
description: Decomposição e gates — Dashboard de Atendimento.
alwaysApply: false
---

# Tasks — Dashboard de Atendimento

## Plano
| #  | Task | Cobre AC | Gate | Status |
|----|------|----------|------|--------|
| 1  | `domain/dashboard-atendimento.ts` (`montarDashboardAtendimento`) + testes puros | AC-1, AC-2 | `vitest` | feito |
| 2  | `ConversaItem` ganha campo `canal` (necessário pro mix de canais e reusado por S04) | — | `vitest`/`tsc` | feito |
| 3  | `application/dashboard-atendimento-gateway.ts` + `contar-autonomia-ia.ts` | AC-1 | `vitest` | feito |
| 4  | `infrastructure/supabase-dashboard-atendimento-adapter.ts` (2 counts, sem escrita) | AC-3 | `tsc` | feito |
| 5  | `pages/AtendimentoDashboardPage.tsx` + wiring em `HomePage.tsx` (`AtendimentoView="dashboard"`) | AC-1, AC-4 | `build` | feito |
| 6  | Rodar `pnpm run ci:local` | todos | `ci:local` | feito |
| 7  | Teste manual em browser com dado real | AC-1 | manual | pendente |
| 8  | Atualizar ROADMAP/STATE | — | revisão humana | feito |

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [x] AC-1 a AC-4 implementados em código local
- [ ] Teste manual em browser com dado real (pendente — mesma ressalva das demais stories de E02)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] Gates locais verdes
