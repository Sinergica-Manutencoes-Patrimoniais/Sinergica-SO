---
name: tasks
description: Decomposição e gates — Ferramentas/Kits CRUD + alocação por técnico.
alwaysApply: false
---

# Tasks — Ferramentas/Kits

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S30_ferramentas.sql`: tabela `pcm.ferramentas` (`id uuid`, `nome text not null`, `categoria_id uuid references pcm.produto_categorias`, `quantidade_total int`, `quantidade_minima int`, `ativo boolean`, `auvo_id bigint unique`, colunas de sync + auditoria), RLS FORCE módulo `pcm`, trigger `fn_auvo_enqueue('ferramentas')` | AC-1, AC-3, AC-7 | E01-S22, E01-S26 mergeadas | `supabase test db` | todo |
| 2  | Migration `00NN_E01-S30_ferramenta_alocacoes.sql`: tabela `pcm.ferramenta_alocacoes` (`id uuid`, `ferramenta_id uuid references pcm.ferramentas`, `auvo_user_id bigint` — referencia o técnico pelo id Auvo, não FK interna, já que `pcm.tecnicos_cache`/`funcionarios` usa esse mesmo padrão de vínculo, `quantidade int not null check (quantidade >= 0)`, `unique(ferramenta_id, auvo_user_id)`, colunas de auditoria), RLS FORCE módulo `pcm` | AC-5, AC-6, AC-7 | 1 | `supabase test db` | todo |
| 3  | Descriptor `registry/ferramentas.ts` (`auvoBasePath:'/products'`, `cronSchedule:'0 */6 * * *'`, `writeEnabled:false`, `toAuvo`/`fromAuvo` incluindo `employeesStock` como dado auxiliar de leitura — não usado pelo `toAuvo` de escrita) | AC-1, AC-2, AC-4 | 1 | teste Deno do descriptor | todo |
| 4  | Nova Edge Function `pcm-auvo-ferramenta-alocacao/index.ts` (chamada direta da UI via `supabase.functions.invoke` ou RPC — **não** passa pelo outbox genérico, ver `spec.md` → Contexto específico): recebe `{ ferramentaAuvoId, tecnicoAuvoId, quantidade }`, chama `PUT /products/employee-product-stock`, grava `pcm.ferramenta_alocacoes` em caso de sucesso | AC-5 | 1, 2 | teste de integração Deno (mock HTTP Auvo) | todo |
| 5  | Poller de `E01-S30` (dentro de `pcm-auvo-pull` de `E01-S23`, ou uma extensão de `fromAuvo` do descriptor de Ferramentas): ao sincronizar uma Ferramenta, reconciliar `pcm.ferramenta_alocacoes` a partir de `employeesStock` | AC-6 | 3, 4 | teste de integração | todo |
| 6  | Domínio/application/infrastructure/páginas: `TiposFerramentaPage` ou `FerramentasPage` (CRUD) + `FerramentasPorTecnicoPage` (alocação, chama a Edge Function da task 4) | AC-1, AC-2, AC-3, AC-5, AC-7 | 3, 4 | `vitest` + manual | todo |
| 7  | Wiring em `HomePage.tsx`: "Ferramentas" (CADASTROS) + "Ferramentas por Técnico" (OPERAÇÃO ou CADASTROS, decidir) | AC-7 | 6 | `pnpm run build` | todo |
| 8  | pgTAP `supabase/tests/ferramentas_rls.test.sql` + `ferramenta_alocacoes_rls.test.sql` | AC-7 | 1, 2 | `supabase test db` | todo |
| 9  | Rodar `pnpm run ci:local` | todos | 1–8 | `pnpm run ci:local` | todo |
| 10 | Atualizar ROADMAP/STATE | — | 9 | revisão humana | todo |

## Plano de teste
- Unidade: domínio (validação de quantidade), descriptor, adapter.
- Integração Deno: `pcm-auvo-ferramenta-alocacao` (mock HTTP Auvo) — chamada bem-sucedida grava
  `pcm.ferramenta_alocacoes`; falha do Auvo não grava nada (nunca estado inconsistente).
- pgTAP: RLS das 2 tabelas.
- Aceite: os 7 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] `PUT /products/employee-product-stock` não é um recurso `id`-endereçável — não cabe no
      descriptor genérico do registry. Documentado em `spec.md` → Contexto específico ANTES de
      implementar: fluxo dedicado (task 4), não uma extensão forçada do motor genérico.

## Checklist de Definition of Done
- [ ] Todos os AC (AC-1 a AC-7) verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
