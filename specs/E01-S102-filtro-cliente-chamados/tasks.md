---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Filtro por cliente na tela de Chamados

## Plano
| #  | Task                                                          | Cobre AC | Depende de | Gate (comando)                          | Status |
|----|---------------------------------------------------------------|----------|------------|-----------------------------------------|--------|
| 1  | Seletor de cliente buscável (autocomplete) no header da lista | AC-1     | —          | Playwright (seleção filtra)             | todo   |
| 2  | Aplicar filtro na query/estado, compondo com filtros atuais   | AC-1,AC-3 | 1         | `pnpm test` (unit do reducer/query)     | todo   |
| 3  | Limpar filtro volta lista completa                            | AC-2     | 1          | Playwright (limpar restaura)            | todo   |

## Plano de teste
- Unidade: composição de filtros (AND) e contagem.
- Aceite: Playwright para AC-1, AC-2, AC-3.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
