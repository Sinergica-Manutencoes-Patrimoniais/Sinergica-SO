---
name: tasks-E01-S91-clientes-marcacoes-status
description: Decomposição — marcações de status de cliente.
alwaysApply: false
---

# Tasks — Marcações de status de cliente

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)          | Status |
|----|-------------------------------------------------------------|----------|------------|-------------------------|--------|
| 1  | Migration: catálogo de marcações + coluna em `pcm.clientes` | AC-1,2   | —          | `pnpm lint:migrations`+pgTAP | done |
| 2  | Domínio: marcação (1 por cliente) + regra de exclusão em uso | AC-2     | —          | `pnpm test`             | done   |
| 3  | Gestão do catálogo (Config, nome+cor)                       | AC-1     | 1,E01-S80  | browser                 | done   |
| 4  | Definir/trocar marcação no cliente + badge                 | AC-2,4   | 1,2        | browser                 | done   |
| 5  | Filtro de listas por marcação (default oculta inativos)     | AC-3     | 4          | browser                 | done   |

## Plano de teste
- Unidade: 1 marcação por cliente; exclusão de marcação em uso.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes
- [x] `pnpm run ci:local` verde; pgTAP RLS escrito
- [x] `docs/STATE.md` + ROADMAP atualizados
