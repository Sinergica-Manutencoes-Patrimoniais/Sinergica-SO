---
name: tasks
description: Decomposição e gates — Flow-builder visual.
alwaysApply: false
---

# Tasks — Config: Flow-builder visual

## Plano
| #  | Task | Cobre AC | Gate | Status |
|----|------|----------|------|--------|
| 1  | Adicionar dependência `@xyflow/react` em `apps/web` | — | `pnpm install` | feito |
| 2  | Migration `0042_E02-S07_atendimento_fluxos.sql` (`definicao jsonb`, RLS) | AC-1, AC-3, AC-5 | `lint:migrations` | feito |
| 3  | pgTAP `atendimento_fluxos_rls.test.sql` | AC-5 | `supabase test db` | feito |
| 4  | `domain/fluxos.ts` (`validarFluxo`, `novoPasso`, `validarPassos`) + testes puros | AC-1, AC-2, AC-3 | `vitest` | feito |
| 5  | `application/fluxo-gateway.ts` + casos de uso + testes | todos | `vitest` | feito |
| 6  | `infrastructure/supabase-fluxo-adapter.ts` | todos | `tsc` | feito |
| 7  | `components/FlowBuilderCanvas.tsx` (nó customizado, drag, sem conexão manual de arestas) + `FluxosManager.tsx` (lista de fluxos + toolbar) | AC-1, AC-2, AC-4 | `build` | feito |
| 8  | 5ª aba "Fluxos" em `AtendimentoConfigPage.tsx` | AC-1 a AC-4 | `build` | feito |
| 9  | Rodar `pnpm run ci:local` | todos | `ci:local` | feito |
| 10 | Teste manual em browser | AC-1 a AC-4 | manual | pendente |
| 11 | Atualizar ROADMAP/STATE | — | revisão humana | feito |

## Divergências (SPEC_DEVIATION)
- Nenhuma — o modelo "checklist sequencial, não árvore de decisão" já está registrado como decisão
  de escopo no `product.md`, resolvida antes de codar.

## Checklist de Definition of Done
- [x] AC-1 a AC-5 implementados em código local
- [ ] Teste manual em browser (pendente)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] Gates locais verdes: `lint:migrations` (42 migrations), `lint`, `typecheck`, `test`
      (214 pass/9 skip), `build` (bundle +~200KB pelo `@xyflow/react`, aceitável), `arch:check`
- [ ] `pnpm run ci:local` verde completo no CI real (pgTAP) — Docker ausente neste ambiente
