---
name: tasks
description: Decomposição e gates — editar cliente diretamente na aba 360.
alwaysApply: false
---

# Tasks — Editar cliente diretamente na aba 360

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Extrair `ClienteFormModal` de `ListaClientesPage.tsx` pra `components/ClienteFormModal.tsx` (prop `cliente` genérico, aceita `ClienteResumo` e `ClienteHeader`) | AC-1 | — | typecheck | done |
| 2  | `ListaClientesPage.tsx` importa do novo arquivo, sem mudar comportamento | — | 1 | typecheck | done |
| 3  | `VisaoClientePage.tsx`: botão "Editar cadastro (local)" + modal + `editarCliente` + recarrega visão | AC-1, AC-2 | 1 | manual | done |
| 4  | Reescrever texto do `PainelCadastroAuvo` | AC-3 | — | manual | done |
| 5  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-4 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Manual: editar cliente pela 360, conferir atualização sem reload; conferir texto do banner.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
