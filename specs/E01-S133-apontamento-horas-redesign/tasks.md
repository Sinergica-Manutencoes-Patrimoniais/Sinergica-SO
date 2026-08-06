---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Redesign do apontamento de horas

> Tier pequeno (UI). Sem migration (a menos que falte agregação de totais no domínio). Consistência
> com o design system é o alvo.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Auditar a tela atual e listar os problemas de layout (o "bagunçado") + oportunidades | AC-1 | revisão | done |
| 2 | Domínio: agregações de totais por técnico/dia/cliente (se ainda não existem) | AC-2 | vitest | done |
| 3 | Redesign: hierarquia (filtros → grupos → linhas), agrupamentos, totais, tokens do design system | AC-1,AC-2 | typecheck | done |
| 4 | Responsivo: sem overflow horizontal; scroll interno onde preciso; estado vazio | AC-3 | typecheck | done |
| 5 | Regressão: valores idênticos aos de antes (só apresentação mudou) | AC-4 | vitest | done |

## Plano de teste
- Unidade: agregações de totais.
- Aceite: Playwright/visual desktop+mobile — layout limpo, totais certos, sem overflow.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright/visual local (Lucas), desktop + mobile
- [ ] ROADMAP.md + STATE.md atualizados
