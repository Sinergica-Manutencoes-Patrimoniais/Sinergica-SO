---
name: tasks
description: Decomposição e gates — CRUD de Serviços (id GUID, idempotência por externalCode).
alwaysApply: false
---

# Tasks — Serviços

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S31_servicos.sql`: tabela `pcm.servicos` (`id uuid`, `titulo text not null`, `preco_centavos int not null check (preco_centavos >= 0)`, `descricao text`, `ativo boolean`, **`auvo_id text unique`** — GUID, não bigint, colunas de sync + auditoria), RLS FORCE módulo `pcm`, trigger `fn_auvo_enqueue('servicos')` | AC-1, AC-3, AC-5, AC-6 | E01-S22 mergeada | `supabase test db` | todo |
| 2  | Descriptor `registry/servicos.ts` (`auvoBasePath:'/services'`, `externalIdField:'externalCode'`, `cronSchedule:'0 */6 * * *'`, `writeEnabled:false`, `toAuvo` converte `preco_centavos` → `price` decimal na borda) | AC-1, AC-2, AC-4, AC-5 | 1 | teste Deno do descriptor (ida-e-volta de preço não perde precisão) | todo |
| 3  | Domínio/application/infrastructure/páginas seguindo o padrão de `E01-S24`, com `auvo_id: string \| null` (não `number`) no adapter/domínio | AC-1, AC-2, AC-3, AC-6 | 2 | `vitest` | todo |
| 4  | Wiring em `HomePage.tsx`: item "Serviços" em CADASTROS | AC-6 | 3 | `pnpm run build` | todo |
| 5  | pgTAP `supabase/tests/servicos_rls.test.sql` | AC-6 | 1 | `supabase test db` | todo |
| 6  | Rodar `pnpm run ci:local` | todos | 1–5 | `pnpm run ci:local` | todo |
| 7  | Atualizar ROADMAP/STATE | — | 6 | revisão humana | todo |

## Plano de teste
- Unidade: domínio (validação de preço em centavos), descriptor (conversão de preço +
  `externalIdField`).
- pgTAP: RLS.
- Aceite: os 6 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] `id`/idempotência de Serviços divergem do resto do catálogo (GUID + `externalCode`) —
      resolvido em `E01-S22` (campo aditivo `externalIdField`, já implementado e testado antes
      desta story existir); documentado em `spec.md` → Contexto específico.

## Checklist de Definition of Done
- [ ] Todos os AC (AC-1 a AC-6) verdes pelo gate executável
- [ ] `auvo_id` tipado como `text`/`string` em toda a stack (migration, TS), nunca `bigint`/`number`
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
