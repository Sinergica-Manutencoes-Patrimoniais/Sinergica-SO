---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Guia SO atualizado (todos os módulos)

> Tier pequeno, conteúdo (sem migration). Verdade do estado = ROADMAP + nav real. Não inventar
> feature: descrever só o que existe; resto = "planejado". Um commit por módulo é ok.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Levantar estado real por módulo (ROADMAP + nav atual) — checklist do que mudou desde os guias | AC-1,AC-4 | revisão | done |
| 2 | Reescrever `FinanceiroGuia.tsx` (prioridade): sem "protótipo"; uso + decisão que apoia | AC-2,AC-3 | typecheck | done |
| 3 | Revisar `PcmGuia.tsx` (board Operação, Chamado→OS, Backlog aba, Anotações, Saúde Auvo) | AC-1,AC-3,AC-4 | typecheck | done |
| 4 | Revisar `AtendimentoGuia.tsx` (Zé, Inbox, Evolution) e `PlanejadosGuia.tsx` | AC-1,AC-3 | typecheck | done |
| 5 | Revisar `VisaoGeralGuia.tsx` (visão macro dos 9 módulos, estado real) | AC-1,AC-4 | typecheck | done |
| 6 | Ajustar `FinanceiroGuia.test.ts` ao novo texto (manter verde) | AC-2 | vitest | done |

## Plano de teste
- Unidade: `FinanceiroGuia.test.ts` verde.
- Aceite: Playwright/visual — abrir cada guia, sem "protótipo", conteúdo coerente com a nav.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright/visual local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
