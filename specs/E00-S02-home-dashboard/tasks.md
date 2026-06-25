---
name: tasks-E00-S02-home-dashboard
description: Tasks do redesign da home com sidebar, abas e dashboard PCM. Registrado retroativamente.
alwaysApply: false
---

# Tasks — E00-S02: Home Dashboard

> Registrado **retroativamente**. Processo correto para próximas stories: tasks.md ANTES de codar.

## Plano
| # | Task | Cobre AC | Gate | Status |
|----|------|----------|------|--------|
| 1 | Adicionar `no-scrollbar` utility em `index.css` | — | build sem erro | ✅ done |
| 2 | Reescrever `HomePage.tsx` — layout `flex h-screen` com sidebar + main | AC-1, AC-2, AC-3 | `pnpm typecheck` | ✅ done |
| 3 | Implementar abas superiores com estado `activeModulo` | AC-3 | visual no browser | ✅ done |
| 4 | Implementar sidebar contextual (PCM_NAV groups / mensagem minimal) | AC-1, AC-2 | visual no browser | ✅ done |
| 5 | Implementar `PcmDashboard` — KpiCard + tabela OS + backlog top | AC-4 | visual no browser | ✅ done |
| 6 | Implementar `EmConstrucao` — placeholder por módulo | AC-5 | visual no browser | ✅ done |
| 7 | Grid responsivo KPIs: `grid-cols-2 lg:grid-cols-4` | AC-6 | visual no browser | ✅ done |

## Débito técnico
- Testes de componente para AC-3, AC-4, AC-5 (Vitest + @testing-library/react) — próxima iteração.
- Dados mock extrair para fixture separada quando banco for conectado.

## Checklist de Definition of Done
- [x] `pnpm typecheck` limpo
- [x] `pnpm lint` limpo
- [x] Dev server renderiza home sem erro de console
- [x] Spec registrada em `specs/E00-S02-home-dashboard/`
- [x] Story registrada em `docs/epics/ROADMAP.md`
- [ ] Testes de componente (débito técnico)
