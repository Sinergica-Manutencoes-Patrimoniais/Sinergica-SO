---
name: tasks-refino-densidade-operacional
description: Tasks e gates do refino visual/operacional PCM.
alwaysApply: false
---

# Tasks — Refino de densidade operacional PCM

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|---|---|---|---|---|
| 1 | Consolidar sinais Auvo de pull + webhook no domínio e adapter | AC-6 | — | `pnpm --filter @sinergica/web test -- src/features/pcm/domain/dashboard-pcm.test.ts` | done |
| 2 | Refinar fila e detalhe da tela de OS | AC-1, AC-2, AC-3 | — | `pnpm --filter @sinergica/web typecheck` | done |
| 3 | Compactar dashboard e enriquecer listas/tooltips | AC-4, AC-5 | 1 | `pnpm --filter @sinergica/web test -- src/features/pcm/domain/dashboard-pcm.test.ts` | done |
| 4 | Aplicar densidade base ao shell e inputs | AC-1 | — | `pnpm --filter @sinergica/web build` | done |
| 5 | Validar regressão e rastreabilidade | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | 1, 2, 3, 4 | `pnpm run ci:local` | todo |

## Plano de teste
- Unidade: consolidação deduplicada de sinais com snapshot vazio e detalhes de pull.
- Integração: typecheck do adapter Supabase e build do frontend.
- Aceite: lint, testes, build e inspeção do layout em desktop responsivo.

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável — gates funcionais verdes; `audit:esteira` bloqueado
  por seis skills preexistentes em `.agents/skills/` sem `alwaysApply`
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Spec reflete o construído
- [x] `docs/STATE.md` atualizado
