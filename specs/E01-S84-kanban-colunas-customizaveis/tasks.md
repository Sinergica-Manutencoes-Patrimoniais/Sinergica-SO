---
name: tasks-E01-S84-kanban-colunas-customizaveis
description: Decomposição — Kanban de OS com colunas customizáveis.
alwaysApply: false
---

# Tasks — Kanban colunas customizáveis

## Plano
| #  | Task                                                          | Cobre AC | Depende de | Gate (comando)      | Status |
|----|---------------------------------------------------------------|----------|------------|---------------------|--------|
| 1  | Modelo de preferência de colunas (ordem + visibilidade) por usuário | AC-1,2 | —      | `pnpm test`         | todo   |
| 2  | Persistência da preferência (migration/preferências de usuário) | AC-1,2 | 1          | `pnpm lint:migrations` | todo |
| 3  | UI: reordenar e ocultar/exibir colunas no Kanban              | AC-1,2   | 1          | browser             | todo   |
| 4  | Coluna "Preventiva" alimentada pelo cronograma PMOC           | AC-3     | 3          | browser             | todo   |
| 5  | Regressão do drag-and-drop de card com colunas customizadas   | AC-4     | 3          | Playwright          | todo   |

## Plano de teste
- Unidade: aplicação de ordem/visibilidade a um conjunto de colunas.
- Aceite: reordenar persiste; ocultar/reexibir; preventiva aparece; DnD segue funcionando.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde + Playwright do Kanban
- [ ] `docs/STATE.md` + ROADMAP atualizados
