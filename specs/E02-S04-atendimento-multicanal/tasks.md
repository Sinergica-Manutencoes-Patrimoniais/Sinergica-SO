---
name: tasks
description: Decomposição e gates — Inbox multi-canal humano.
alwaysApply: false
---

# Tasks — Inbox Multi-canal Humano

## Plano
| #  | Task | Cobre AC | Gate | Status |
|----|------|----------|------|--------|
| 1  | Migrations `0044`/`0046`: expandir e validar check de `conversas.canal` | AC-1 | `lint:migrations`/pgTAP CI | feito |
| 2  | `domain/conversas.ts`: labels de canal e regra `canalSuportaIa` + testes puros | AC-2, AC-3 | `vitest` | feito |
| 3  | `ConversaLista`/`ConversaChat`: badge de canal e ações de IA só no WhatsApp | AC-2, AC-3 | `typecheck`/`build` | feito |
| 4  | `supabase-atendimento-adapter`: guarda defensiva contra `acionarZeAgora` fora do WhatsApp | AC-3 | `typecheck` | feito |
| 5  | Dashboard reaproveita `ConversaItem.canal` para mix de canais | AC-4 | `vitest` existente | feito |
| 6  | Atualizar ROADMAP/STATE | — | revisão humana | feito |
| 7  | Teste manual em browser com dado real multi-canal | AC-2 a AC-4 | manual | pendente |

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [x] AC-1 a AC-4 implementados em código local
- [ ] Teste manual em browser com dado real multi-canal
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] Gates locais verdes: `ci:local` (216 pass/9 skip), `lint:migrations`, `lint`, `typecheck`,
  `test`, `build`, `arch:check`, `audit:esteira`, `eval:spec`
