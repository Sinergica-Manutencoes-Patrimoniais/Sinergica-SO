---
name: tasks-E01-S97-galeria-fotos-item-inspecao
description: Decomposição — galeria de fotos no item de inspeção importado.
alwaysApply: false
---

# Tasks — Galeria de fotos no item de inspeção importado

## Plano
| #  | Task                                                                              | Cobre AC | Depende de | Gate (comando)       | Status |
|----|--------------------------------------------------------------------------------------|----------|------------|----------------------|--------|
| 1  | Migration `0150`: `pcm.inspecao_itens` ganha `foto_urls jsonb not null default '[]'` | AC-1     | —          | `lint:migrations`    | done   |
| 2  | `ITEM_COLS`/`mapItem`: ler `foto_urls` → `InspecaoItem.fotoUrls: string[]`           | AC-1     | Task 1     | `typecheck`          | done   |
| 3  | `criarInspecaoImportada`: gravar a lista completa (`foto_urls: fotos`), não só `fotos[0]` | AC-1  | Task 1, 2  | `typecheck`          | done   |
| 4  | `InspecoesPage.tsx`: galeria de thumbnails quando `fotoUrls.length > 1`, mantém exibição atual para 0/1 | AC-2, AC-3 | Task 2 | browser | done   |

## Plano de teste
- Aceite: import de XLS com ocorrência de 2+ fotos grava todas em `foto_urls`; tela mostra galeria; item com 1 foto ou sem foto não regride.

## Checklist de Definition of Done
- [x] AC-1 a AC-3 verdes
- [x] `pnpm run ci:local`-equivalente verde
- [x] `docs/STATE.md` + ROADMAP atualizados
- [ ] Migration `0150` aplicada em produção (`supabase db push --linked`) — pendente de autorização do Lucas
