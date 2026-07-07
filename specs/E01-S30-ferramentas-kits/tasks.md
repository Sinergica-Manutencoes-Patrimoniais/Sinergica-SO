---
name: tasks
description: Decomposição e gates — Ferramentas/Kits CRUD + alocação por técnico.
alwaysApply: false
---

# Tasks — Ferramentas/Kits

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S30_ferramentas.sql`: tabela `pcm.ferramentas` (`id uuid`, `nome text not null`, `categoria_id uuid references pcm.produto_categorias`, `quantidade_total int`, `quantidade_minima int`, `ativo boolean`, `auvo_id bigint unique`, colunas de sync + auditoria), RLS FORCE módulo `pcm`, trigger `fn_auvo_enqueue('ferramentas')` | AC-1, AC-3, AC-7 | E01-S22, E01-S26 mergeadas | `supabase test db` | done |
| 2  | Migration `00NN_E01-S30_ferramenta_alocacoes.sql`: tabela `pcm.ferramenta_alocacoes` (`id uuid`, `ferramenta_id uuid references pcm.ferramentas`, `auvo_user_id bigint` — referencia o técnico pelo id Auvo, não FK interna, já que `pcm.tecnicos_cache`/`funcionarios` usa esse mesmo padrão de vínculo, `quantidade int not null check (quantidade >= 0)`, `unique(ferramenta_id, auvo_user_id)`, colunas de auditoria), RLS FORCE módulo `pcm` | AC-5, AC-6, AC-7 | 1 | `supabase test db` | done |
| 3  | Descriptor `registry/ferramentas.ts` (`auvoBasePath:'/products'`, `cronSchedule:'0 */6 * * *'`, `writeEnabled:false`, `toAuvo`/`fromAuvo` incluindo `employeesStock` como dado auxiliar de leitura — não usado pelo `toAuvo` de escrita) | AC-1, AC-2, AC-4 | 1 | teste Deno do descriptor | done |
| 4  | Nova Edge Function `pcm-auvo-ferramenta-alocacao/index.ts` (chamada direta da UI via `supabase.functions.invoke` ou RPC — **não** passa pelo outbox genérico, ver `spec.md` → Contexto específico): recebe `{ ferramentaAuvoId, tecnicoAuvoId, quantidade }`, chama `PUT /products/employee-product-stock`, grava `pcm.ferramenta_alocacoes` em caso de sucesso | AC-5 | 1, 2 | teste de integração Deno (mock HTTP Auvo) | done |
| 5  | Poller de `E01-S30` (dentro de `pcm-auvo-pull` de `E01-S23`, ou uma extensão de `fromAuvo` do descriptor de Ferramentas): ao sincronizar uma Ferramenta, reconciliar `pcm.ferramenta_alocacoes` a partir de `employeesStock` | AC-6 | 3, 4 | teste de integração | done |
| 6  | Domínio/application/infrastructure/páginas: `TiposFerramentaPage` ou `FerramentasPage` (CRUD) + `FerramentasPorTecnicoPage` (alocação, chama a Edge Function da task 4) | AC-1, AC-2, AC-3, AC-5, AC-7 | 3, 4 | `vitest` + manual | done |
| 7  | Wiring em `HomePage.tsx`: "Ferramentas" (CADASTROS) + "Ferramentas por Técnico" (OPERAÇÃO ou CADASTROS, decidir) | AC-7 | 6 | `pnpm run build` | done |
| 8  | pgTAP `supabase/tests/ferramentas_rls.test.sql` + `ferramenta_alocacoes_rls.test.sql` | AC-7 | 1, 2 | `supabase test db` | done |
| 9  | Rodar `pnpm run ci:local` | todos | 1–8 | `pnpm run ci:local` | done |
| 10 | Atualizar ROADMAP/STATE | — | 9 | revisão humana | done |

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
- [x] O `pcm-auvo-pull` foi corrigido para não tratar `writeEnabled:false` como bloqueio de
      leitura. O gate continua protegendo o drain de escrita (`pcm-auvo-push`); o poller GET pode
      reconciliar dados de entidades registradas por cron.
- [x] A execução de teste manual/browser com dado real não foi feita: criaria/alteraria alocação
      real no Auvo. UAT deve usar ferramenta/técnico descartáveis e reverter a alocação ao fim.

## Revisão adversarial (2026-07-07)
- **Follow-up não corrigido (médio)** — `domain/ferramentas.ts` (`validarAlocacao`) valida a
  quantidade alocada contra `quantidadeTotal` (estoque total), não contra o saldo já alocado a
  outros técnicos — a UI deixa preencher uma alocação que estoura o total antes de submeter. O
  backend está correto: `pcm-auvo-ferramenta-alocacao/index.ts` (`validarQuantidadeTotal`) soma
  todas as alocações existentes e rejeita com 409, protegendo a integridade do dado — mas sem lock/
  `CHECK` no banco, duas alocações concorrentes ainda podem passar na checagem antes de qualquer
  commit. Recomendado: replicar a soma no domínio (UX) e considerar um `CHECK`/trigger de invariante
  no schema (correção estrutural, fora do escopo de um fix pontual desta revisão).

## Checklist de Definition of Done
- [x] Todos os AC (AC-1 a AC-7) verdes pelo gate executável local disponível
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] `pnpm run ci:local` verde
