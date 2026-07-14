---
name: tasks
description: Decomposição e gates — imagem e anexos de equipamentos do Auvo.
alwaysApply: false
---

# Tasks — E01-S71 · Imagem de equipamentos

> Marcar owner no ROADMAP. Branch: `feat/E01-S71-imagem-equipamentos`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E01-S71_equipamentos_imagem.sql`: `alter table pcm.equipamentos add column url_imagem text, add column uri_anexos jsonb default '[]'::jsonb` (aditivo, sem mexer em RLS/grants) | AC-1 | — | `pnpm run lint:migrations` | todo |
| 2 | `registry/equipamentos.ts`: adicionar `urlImage`/`uriAnexos` ao tipo `AuvoEquipment` e mapear em `fromAuvo` (`url_imagem`/`uri_anexos`). Teste Deno do `fromAuvo` | AC-2 | 1 | `deno test` (CI) | todo |
| 3 | UI: `EquipamentosPage.tsx` exibe thumbnail de `url_imagem` (abrir maior ao clicar); `VisaoClientePage.tsx` painel de equipamentos idem; placeholder quando ausente. Adapter/domain de equipamentos expõem os novos campos | AC-3 | 1 | `pnpm run test` | todo |
| 4 | `pnpm run ci:local` + Playwright (equipamento com imagem mostra foto) + re-sync (ou aguardar cron) pra popular + ROADMAP/STATE | todos | 1-3 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit Deno: `fromAuvo` mapeia `urlImage`→`url_imagem`, `uriAnexos`→`uri_anexos`.
- Playwright: card de equipamento com imagem.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes · `ci:local` verde · `url_imagem` só popula após re-sync do pull de equipamentos ·
  ROADMAP/STATE atualizados
