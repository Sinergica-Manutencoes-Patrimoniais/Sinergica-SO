---
name: tasks
description: Decomposição e gates — CRUD de Segmentos + Palavras-chave.
alwaysApply: false
---

# Tasks — Segmentos + Palavras-chave

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0028_E01-S25_segmentos_palavras_chave.sql`: tabelas `pcm.segmentos` e `pcm.palavras_chave` (`id uuid`, `descricao text not null`, `auvo_id bigint unique`, colunas de sync + auditoria, SEM coluna `ativo` — não existe contraparte no Auvo, ver spec.md), RLS FORCE módulo `pcm`, triggers `fn_auvo_enqueue('segmentos')`/`fn_auvo_enqueue('palavras_chave')` | AC-1, AC-3, AC-6 | E01-S22 mergeada | `supabase test db` | feito (migration; pgTAP não executado — sem Docker) |
| 2  | Descriptors em `registry/catalogos-simples.ts` (`auvoBasePath: '/segments'`/`'/keywords'`, `deleteStrategy:'hard-delete'`, `cronSchedule` diário, `writeEnabled:false`) + registrar em `registry/index.ts` | AC-1, AC-2, AC-4 | 1 | teste Deno dos descriptors | feito (código/teste; Deno não executado — sem Deno CLI) |
| 3  | Domínio/application/infrastructure/páginas — slice compartilhado `catalogos-simples` para as 2 entidades (`SegmentosPage` e `PalavrasChavePage` usam o mesmo contrato `descricao`) | AC-1, AC-2, AC-3, AC-5 | 2 | `vitest` | feito |
| 4  | Wiring em `HomePage.tsx`: 2 itens novos em CADASTROS (`segmentos`, `palavras-chave`) | AC-5 | 3 | `pnpm run build` | feito |
| 5  | pgTAP `supabase/tests/segmentos_palavras_chave_rls.test.sql` | AC-6 | 1 | `supabase test db` | pendente (sem Docker local) |
| 6  | Rodar `pnpm run ci:local` | todos | 1–5 | `pnpm run ci:local` | feito parcialmente — `lint:migrations`, `lint`, `typecheck`, `test` (138 pass/9 skip), `build`, `audit:esteira`, `arch:check` verdes; Deno/pgTAP/browser real pendentes |
| 7  | Atualizar ROADMAP/STATE | — | 6 | revisão humana | feito |

## Plano de teste
- Unidade: domínio×2, use cases×2, descriptors×2 (mapeamento + `deleteStrategy`).
- pgTAP: RLS das 2 tabelas.
- Aceite: os 6 AC (rodados 2x, uma vez por entidade).

## Divergências (SPEC_DEVIATION)
- [x] `AuvoEntityDescriptor` não previa exclusão física — resolvido em `E01-S22` (campo aditivo
      `deleteStrategy`, já implementado e testado em `pcm-auvo-push` antes desta story existir).

## Revisão adversarial (2026-07-07)
- **CORRIGIDO** — `pcm.segmentos.created_by`/`pcm.palavras_chave.created_by` estavam `not null` sem
  default (migration `0028`), mas `fn_upsert_auvo_sync` (pull/webhook inbound) nunca preenche essa
  coluna — o primeiro registro novo vindo do Auvo estouraria `NOT NULL violation`. Retrofitado para
  nullable, mesma correção aplicada em `E01-S24`/`E01-S26`/`E01-S27`.
- **Follow-up não corrigido** — mesma lacuna de `E01-S24`: mitigação "match-by-description" do
  `design.md` de `E01-S22` para `/segments`/`/keywords` (sem `externalId` no POST) não foi
  implementada. Dormente hoje; risco de duplicata em retry após `writeEnabled:true`.

## Checklist de Definition of Done
- [x] AC-1 a AC-6 implementados em código local
- [ ] Todos os AC verdes pelo gate executável completo (Deno/pgTAP/browser)
- [x] `deleteStrategy: 'hard-delete'` documentado como decisão consciente (perda de histórico no
      Auvo aceitável para metadados de classificação) — não usar esse valor para nenhuma outra
      entidade sem a mesma análise de risco
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde completo; localmente ficaram verdes os gates Node listados na task 6,
      mas Deno/pgTAP e teste manual com dado reversível ainda precisam rodar no ambiente adequado
