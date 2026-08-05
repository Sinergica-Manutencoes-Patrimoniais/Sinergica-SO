---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Tooltips nos badges do cliente

> Tier trivial (≤2 arquivos, sem migration, sem dado). Reusa `Tooltip`.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Mapear os badges exibidos (status/tipo/marcação/contrato/Auvo) e escrever a frase de cada um (constante de copy) | AC-1,AC-2 | revisão | todo |
| 2 | Envolver cada badge/seletor com `Tooltip content=...` no cabeçalho/linha do cliente | AC-1,AC-2,AC-3 | typecheck | todo |
| 3 | Regressão: nenhum `onChange`/mutação nova; só hover | AC-3 | vitest/biome | todo |

## Plano de teste
- Aceite: Playwright — hover em cada badge mostra o texto certo; distinção status × marcação clara.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
