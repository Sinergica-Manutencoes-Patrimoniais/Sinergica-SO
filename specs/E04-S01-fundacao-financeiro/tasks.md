---
name: tasks
description: Decomposição e gates — fundação do módulo Financeiro (schema + lançamentos + categorias + contas).
alwaysApply: false
---

# Tasks — E04-S01 · Fundação do caixa

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (seção E04). Ler `design.md` (contrato
> de colunas/RLS) e `domain.md` (invariantes). Branch: `feat/E04-S01-fundacao-financeiro` — nunca
> push direto na `main`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E04-S01_fundacao_financeiro.sql`: `grant usage` no schema, 4 tabelas (contrato no `design.md`), RLS FORCE + policies leitura/escrita por `user_modulos.financeiro`, seed do plano de contas, trigger `updated_at` se padrão do repo | AC-1, AC-2 | — | `pnpm run lint:migrations` | done |
| 2 | Expor schema `financeiro` no PostgREST: `db.schemas` em `supabase/config.toml` (+ nota de deploy: conferir exposição em produção, mesmo passo da E00-S05) | AC-1 | 1 | manual (config) | done |
| 3 | `domain/`: `lancamento.ts` (invariantes: previsto⇒vencimento, realizado⇒pagamento, valor>0, baixa/estorno), `categoria.ts` (2 níveis, tipo herdado), conversão R$↔centavos por string (nunca float) — unit tests | AC-3, AC-5 | — | `pnpm run test` | done |
| 4 | `application/` porta `financeiro-gateway.ts` + casos de uso (listar/criar/editar lançamento, baixa, CRUD categorias/contas/fornecedores) · `infrastructure/supabase-financeiro-adapter.ts` (supabase-js sob RLS) | AC-3–AC-6 | 3 | `pnpm run test` | done |
| 5 | `LancamentosPage` (lista + filtros + totais do filtro + modal criar/editar + baixa/estorno) — padrão visual das páginas PCM (`OrdensServicoPage` como referência) | AC-3, AC-4, AC-5 | 4 | `pnpm run test` | done |
| 6 | `CategoriasPage` (árvore 2 níveis, criar/editar/desativar) + `ContasPage` (CRUD + saldo derivado via RPC/query) | AC-2, AC-6 | 4 | `pnpm run test` | done |
| 7 | Navegação: grupo FINANCEIRO na sidebar (`HomePage.tsx`), gate `podeAcessar('financeiro', ...)`; read-only sem `escrita` | AC-7 | 5, 6 | `pnpm run test` | done |
| 8 | pgTAP `supabase/tests/financeiro_fundacao_rls.test.sql` (deny sem módulo, leitura sem escrita, escrita com `escrita`/superadmin) | AC-1 | 1 | CI `db-tests` | done |
| 9 | `pnpm run ci:local` + Playwright contra dev server (criar lançamento, filtrar, baixa — regra do projeto: sempre rodar Playwright antes de reportar pronto) + atualizar ROADMAP/STATE + glossário conferido | todos | 1–8 | `pnpm run ci:local` | done |

## Plano de teste
- Unit (domínio): invariantes do lançamento, baixa/estorno, hierarquia de categoria, conversão
  centavos (casos: "1.234,56", "0,01", vazio, negativo → erro).
- pgTAP: RLS das 4 tabelas nos 4 perfis (sem módulo / leitura / escrita / superadmin).
- Playwright (dev server local, nunca Netlify de produção): fluxo criar→filtrar→baixar.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo comando
- [x] `pnpm run ci:local` verde (sem check pulado; `db-tests` exige Docker/CI)
- [x] Revisão adversarial feita (borda: lançamento sem categoria? conta desativada com saldo?)
- [x] ROADMAP/STATE/glossário atualizados
