---
name: tasks
description: Decomposição e gates — Config de IA multi-persona.
alwaysApply: false
---

# Tasks — Config: IA + Personas + Base de Conhecimento

## Plano
| #  | Task | Cobre AC | Gate | Status |
|----|------|----------|------|--------|
| 1  | Migration `0041_E02-S06_atendimento_personas.sql` (`personas`+`instancias_agente`, RLS, seed do prompt atual do Zé) | AC-1, AC-5 | `lint:migrations` | feito |
| 2  | pgTAP `atendimento_personas_rls.test.sql` | AC-5 | `supabase test db` | feito |
| 3  | `pcm-ze-agent/index.ts`: `buscarPersona()` + `extrairChamadoViaOpenRouter` usa `promptSistema` em vez de string fixa | AC-3 | teste Deno de regressão | feito |
| 4  | `domain/{personas,instancias-agente}.ts` + testes puros | AC-1, AC-4 | `vitest` | feito |
| 5  | `application/config-gateway.ts` estendido (6 métodos novos) + casos de uso + testes | todos | `vitest` | feito |
| 6  | `infrastructure/supabase-config-adapter.ts` estendido | todos | `tsc` | feito |
| 7  | `components/{PersonasList,InstanciasAgenteList}.tsx` + 2 abas novas em `AtendimentoConfigPage.tsx` | AC-1, AC-2, AC-4 | `build` | feito |
| 8  | Rodar `pnpm run ci:local` | todos | `ci:local` | feito |
| 9  | Teste manual em browser | AC-1 a AC-4 | manual | pendente |
| 10 | Atualizar ROADMAP/STATE | — | revisão humana | feito |

## Divergências (SPEC_DEVIATION)
- Nenhuma — a decisão de RAG simples (texto, não vetorial) e `tipo` fechado ao invés de texto
  livre já estão registradas como decisão de escopo no `product.md`, não como desvio de spec
  aprovada (a spec já nasceu com essas decisões).

## Checklist de Definition of Done
- [x] AC-1 a AC-5 implementados em código local
- [ ] Teste manual em browser (pendente)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] Gates locais verdes: `lint:migrations` (41 migrations), `lint`, `typecheck`, `test`
      (201 pass/9 skip), `build`, `arch:check`
- [ ] `pnpm run ci:local` verde completo no CI real (pgTAP/Deno) — Docker ausente neste ambiente
