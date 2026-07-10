---
name: tasks
description: Decomposição e gates — banner de transparência escrita-local-não-vai-pro-Auvo.
alwaysApply: false
---

# Tasks — Banner "escrita local ainda não vai pro Auvo"

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Novo `apps/web/src/features/pcm/components/BannerEscritaAuvoPendente.tsx` | AC-1, AC-2 | — | typecheck | done |
| 2  | Plugar em `FerramentasPage.tsx` | AC-1 | 1 | manual | done |
| 3  | Plugar em `CatalogoSimplesPage.tsx` (cobre Categorias/Segmentos/Palavras-chave) | AC-1 | 1 | manual | done |
| 4  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-3 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Manual: abrir cada tela, conferir banner visível.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
