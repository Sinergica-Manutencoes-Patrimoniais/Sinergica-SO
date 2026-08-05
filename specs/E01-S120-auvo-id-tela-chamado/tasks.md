---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — ID do Auvo visível na tela do Chamado/OS

> Code-only, sem migration (`auvoTaskId` já existe no domínio/adapter). Tier pequeno.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Domínio: helper `auvoTaskDeepLink(auvoTaskId)` (retorna URL ou `null`) + teste | AC-2, AC-3 | vitest | done |
| 2 | `DetalheOs` (OrdensServicoPage): troca `Task ${auvoTaskId}` por badge `Auvo #<id>` clicável; estado neutro "Sem OS no Auvo" quando null | AC-1, AC-2, AC-3 | typecheck | done |
| 3 | `ChamadoPainel`: seção de vínculo Auvo — `Auvo #<id>` clicável quando a OS ligada tem `auvoTaskId`; senão "Sem OS no Auvo" | AC-1, AC-2, AC-3 | typecheck | done |
| 4 | Regressão visual/e2e: badge aparece no painel; clique abre nova aba (verificar `target=_blank`) | AC-2 | playwright (Lucas) | todo |

## Plano de teste
- Unidade: `auvoTaskDeepLink` (id válido / null / <=0).
- Aceite: Playwright — abrir OS com task Auvo, ver `Auvo #<id>`; abrir Chamado sem OS, ver estado neutro.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate (typecheck/vitest/biome)
- [ ] Playwright rodado localmente (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
