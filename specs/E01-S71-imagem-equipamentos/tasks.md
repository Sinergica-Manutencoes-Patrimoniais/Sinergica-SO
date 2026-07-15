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
| 1 | Migration `0085_E01-S71_equipamentos_imagem.sql`: `alter table pcm.equipamentos add column url_imagem text, add column uri_anexos jsonb default '[]'::jsonb` (aditivo, sem mexer em RLS/grants) | AC-1 | — | `pnpm run lint:migrations` | **done** |
| 2 | `registry/equipamentos.ts`: `urlImage`/`uriAnexos` adicionados ao tipo `AuvoEquipment` e mapeados em `fromAuvo` (`url_imagem`/`uri_anexos`). Teste Deno do `fromAuvo` (3 casos: com valores, sem valores→null/[], regressão do teste existente) | AC-2 | 1 | `deno test` (CI) | **done** (código+testes escritos; Deno CLI ausente local, roda no CI) |
| 3 | UI: `EquipamentosPage.tsx` exibe thumbnail de `url_imagem` no card (abre lightbox ao clicar); `VisaoClientePage.tsx`/`PainelEquipamentos.tsx` idem em miniatura; placeholder (ícone `Wrench`/quadrado cinza) quando ausente. `EquipamentoItem`/`EquipamentoResumo` (domain) e os 2 adapters (`supabase-equipamentos-adapter.ts`, `supabase-cliente-360-adapter.ts`) expõem os novos campos | AC-3 | 1 | `pnpm run test` | **done** |
| 4 | Gates + ROADMAP/STATE | todos | 1-3 | `pnpm exec biome check --write .`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, `pnpm run arch:check`, `pnpm run lint:migrations`, `pnpm run check:edge-functions`, `pnpm run audit:esteira`, `pnpm run eval:spec`, `node scripts/validate-mermaid.mjs` | **done, todos verdes** — verificação visual em browser **não realizada** (sem Playwright/browser tool disponível neste ambiente); `url_imagem` só popula em produção após próximo pull de equipamentos do Auvo (cron ou re-sync manual) |

## Plano de teste
- Unit Deno: `fromAuvo` mapeia `urlImage`→`url_imagem`, `uriAnexos`→`uri_anexos`.
- Playwright: card de equipamento com imagem.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes · `ci:local` verde · `url_imagem` só popula após re-sync do pull de equipamentos ·
  ROADMAP/STATE atualizados
