---
name: tasks-E01-S82-priorizacao-gutd
description: Decomposição — priorização GUTD com pesos configuráveis.
alwaysApply: false
---

# Tasks — Priorização GUTD

## Plano
| #  | Task                                                            | Cobre AC | Depende de | Gate (comando)          | Status |
|----|-----------------------------------------------------------------|----------|------------|-------------------------|--------|
| 1  | Domínio: fórmula ponderada `wG·G+wU·U+wT·T+wD·D` + regra D ausente | AC-2,4 | —          | `pnpm test priorizacao` | todo   |
| 2  | Persistência dos pesos + validação soma=100% (config)           | AC-3     | 1          | `pnpm test` + migration | todo   |
| 3  | Seção Config → Priorização (superadmin) editando os 4 pesos      | AC-3     | 2          | browser                 | todo   |
| 4  | Campo D no form de OS/backlog + `GUT_OPCOES` estendido           | AC-1     | 1          | browser                 | todo   |
| 5  | Ordenação backlog/hub usa prioridade ponderada em runtime       | AC-2     | 1,4        | `pnpm test` + browser   | todo   |

## Plano de teste
- Unidade: fórmula (casos da matriz de decisão), soma≠100 rejeitada, D ausente neutro.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Default de pesos GUT/D a confirmar com Fabrício — usar pesos iguais como fallback até decisão.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde
- [ ] Spec E01-S01 anotada como estendida por esta story
- [ ] `docs/STATE.md` + ROADMAP atualizados
