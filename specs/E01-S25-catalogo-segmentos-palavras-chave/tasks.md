---
name: tasks
description: Decomposição e gates — CRUD de Segmentos + Palavras-chave.
alwaysApply: false
---

# Tasks — Segmentos + Palavras-chave

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S25_segmentos_palavras_chave.sql`: tabelas `pcm.segmentos` e `pcm.palavras_chave` (`id uuid`, `descricao text not null`, `auvo_id bigint unique`, colunas de sync + auditoria, SEM coluna `ativo` — não existe contraparte no Auvo, ver spec.md), RLS FORCE módulo `pcm`, triggers `fn_auvo_enqueue('segmentos')`/`fn_auvo_enqueue('palavras_chave')` | AC-1, AC-3, AC-6 | E01-S22 mergeada | `supabase test db` | todo |
| 2  | Descriptors `registry/segmentos.ts` e `registry/palavras-chave.ts` (`auvoBasePath: '/segments'`/`'/keywords'`, `deleteStrategy:'hard-delete'` — campo já existe em `AuvoEntityDescriptor` desde `E01-S22`, não precisa estender o tipo — `cronSchedule` diário, `writeEnabled:false`) + registrar em `registry/index.ts` | AC-1, AC-2, AC-4 | 1 | teste Deno dos descriptors | todo |
| 3  | Domínio/application/infrastructure/páginas — 2 slices análogos (`domain/segmentos.ts` + `domain/palavras-chave.ts`, gateways/use cases/adapters/páginas seguindo o padrão de `E01-S24`) | AC-1, AC-2, AC-3, AC-5 | 2 | `vitest` | todo |
| 4  | Wiring em `HomePage.tsx`: 2 itens novos em CADASTROS (`segmentos`, `palavras-chave`) | AC-5 | 3 | `pnpm run build` | todo |
| 5  | pgTAP `supabase/tests/segmentos_palavras_chave_rls.test.sql` | AC-6 | 1 | `supabase test db` | todo |
| 6  | Rodar `pnpm run ci:local` | todos | 1–5 | `pnpm run ci:local` | todo |
| 7  | Atualizar ROADMAP/STATE | — | 6 | revisão humana | todo |

## Plano de teste
- Unidade: domínio×2, use cases×2, descriptors×2 (mapeamento + `deleteStrategy`).
- pgTAP: RLS das 2 tabelas.
- Aceite: os 6 AC (rodados 2x, uma vez por entidade).

## Divergências (SPEC_DEVIATION)
- [x] `AuvoEntityDescriptor` não previa exclusão física — resolvido em `E01-S22` (campo aditivo
      `deleteStrategy`, já implementado e testado em `pcm-auvo-push` antes desta story existir).

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] `deleteStrategy: 'hard-delete'` documentado como decisão consciente (perda de histórico no
      Auvo aceitável para metadados de classificação) — não usar esse valor para nenhuma outra
      entidade sem a mesma análise de risco
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
