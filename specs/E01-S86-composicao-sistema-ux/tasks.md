---
name: tasks-E01-S86-composicao-sistema-ux
description: Decomposição — composição de sistema por checkbox+filtro.
alwaysApply: false
---

# Tasks — Composição de Sistema (checkbox + filtro)

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)   | Status |
|----|-------------------------------------------------------------|----------|------------|------------------|--------|
| 1  | Componente compartilhado: lista com checkbox + filtro nome  | AC-1     | —          | `pnpm test`      | todo   |
| 2  | Persistir composição via vínculo Sistema↔Componentes        | AC-1,3   | 1          | `pnpm test`      | todo   |
| 3  | Integrar seletor no PCM (Equipamentos/Board)                | AC-1     | 1,2        | browser          | todo   |
| 4  | Integrar seletor na Visão 360 (gated `pcm:escrita`)         | AC-2     | 1,2        | browser          | todo   |
| 5  | Itens já pertencentes vêm marcados                          | AC-3     | 2          | `pnpm test`      | todo   |

## Plano de teste
- Unidade: filtro por nome, toggle de seleção, diff de composição.
- Aceite: compor no PCM e na 360 dá o mesmo resultado; itens existentes pré-marcados.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [ ] AC-1..AC-3 verdes
- [ ] `pnpm run ci:local` verde + Playwright dos dois pontos de entrada
- [ ] `docs/STATE.md` + ROADMAP atualizados
