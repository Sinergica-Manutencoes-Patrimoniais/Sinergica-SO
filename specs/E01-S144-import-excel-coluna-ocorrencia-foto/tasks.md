---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Import Excel: coluna "Ocorrência" é foto, não relato

> Tier trivial. Fix de heurística de parsing, sem migration, sem UI nova.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Remove "ocorrencia" dos aliases de `relatoIndex`; adiciona aos aliases de `fotosIndex` | AC-1,AC-2,AC-3 | vitest | done |
| 2 | Teste cobrindo o caso real do Lucas (coluna "Ocorrência" com 2 URLs separadas por `;`) | AC-1 | vitest | done |

## Plano de teste
- Unidade: `parsearPlanilhaLevantamento` com planilha `[["Local","Ocorrência","Relato"], [...]]` —
  fotos vêm de "Ocorrência", relato de "Relato".
- Unidade: planilha só com "Ocorrência" (sem coluna de relato) — lança o erro existente.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] vitest local verde
- [ ] ROADMAP.md atualizado
