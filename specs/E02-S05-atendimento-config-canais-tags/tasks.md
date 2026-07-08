---
name: tasks
description: Decomposição e gates — Config de Atendimento (canal + tags).
alwaysApply: false
---

# Tasks — Config: Canais + Tags

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0040_E02-S05_atendimento_tags.sql`: tabela `atendimento.tags` (`nome` unique case-insensitive, `ativo`), RLS FORCE, grants, policies (molde de `0028_E01-S25_segmentos_palavras_chave.sql`) | AC-2, AC-3, AC-5 | E02-S01 mergeada | `lint:migrations` | feito |
| 2  | pgTAP `atendimento_tags_rls.test.sql` | AC-5 | 1 | `supabase test db` | feito |
| 3  | `domain/tags.ts` (validação nome, sem tipo union — só 1 catálogo) + `domain/config-canal.ts` (validação form) + testes puros | AC-1, AC-2 | 1 | `vitest` | feito |
| 4  | `application/config-gateway.ts` + casos de uso (`listar-tags`, `criar-tag`, `editar-tag`, `desativar-tag`, `buscar-config-canal`, `salvar-config-canal`) + testes | todos | 3 | `vitest` | feito |
| 5  | `infrastructure/supabase-config-adapter.ts` | todos | 4 | `pnpm run typecheck` | feito |
| 6  | `components/{TagsList,ConfigCanalForm}.tsx` + `pages/AtendimentoConfigPage.tsx` | AC-1 a AC-4 | 5 | `pnpm run build` | feito |
| 7  | Wiring em `HomePage.tsx` (`AtendimentoView="config"` + item "Config" em `ATENDIMENTO_NAV`) | AC-4 | 6 | `pnpm run build` | feito |
| 8  | Rodar `pnpm run ci:local` | todos | 1-7 | `pnpm run ci:local` | feito |
| 9  | Teste manual em browser (dev server + `.env.local`) | AC-1 a AC-4 | 8 | manual | pendente |
| 10 | Atualizar ROADMAP/STATE | — | 9 | revisão humana | feito |

## Plano de teste
- Unidade: `validarTag`/`validarConfigCanal` (domain), casos de uso (delegação + validação, mesmo
  padrão de `criarCatalogoSimples`).
- pgTAP: RLS FORCE de `atendimento.tags` (AC-5).
- Manual: criar/editar config de canal de um cliente de teste; criar/desativar tag; confirmar que
  desativar não quebra conversas que já a usam.
- Aceite: os 5 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC (AC-1 a AC-5) implementados em código local
- [ ] Teste manual em browser executado com dado real (pendente — mesma ressalva de S01/S02)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] Gates locais verdes: `lint:migrations` (40 migrations), `lint`, `typecheck`, `test`
      (186 pass/9 skip), `build`, `arch:check`, `audit:esteira` (187 docs), `eval:spec`,
      `pnpm run ci:local` (mirror completo do lefthook pre-push)
- [ ] `pnpm run ci:local` verde completo no CI real (pgTAP) — confirmar antes do merge (Docker
      ausente neste ambiente, mesma ressalva de toda a integração desde E01-S09)
