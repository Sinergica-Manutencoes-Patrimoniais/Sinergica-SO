# Tasks: Marketing — indicadores da Meta e rastreio até a venda (E06-S01)

Uma linha por task. Detalhe técnico (DDL, assinaturas, campos da Graph) está no
[plan.md](./plan.md) — não se repete aqui. Toda task cita o(s) `AC-N` que prova.

## Fase 1 — Setup

- [x] T001 Abrir a linha E06-S01 com owner e atualizar o status do épico E06 em `docs/epics/ROADMAP.md`
- [x] T002 Escrever `docs/adr/1699-marketing-indicadores-meta-atribuicao.md` (schema próprio, atribuição, fora de escopo) — pré-requisito de tier arquitetural
- [x] T003 Escrever `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` em `specs/E06-S01-indicadores-meta-rastreio/`

## Fase 2 — Fundação (bloqueia todas as histórias)

- [x] T004 Criar `supabase/migrations/1900_E06-S01_marketing_indicadores_meta.sql` com as 8 tabelas do schema `marketing`, `enable` + `force row level security`, GRANT explícito e reverso documentado no topo — AC-1, AC-8
- [x] T005 Na mesma migration, policies por `user_modulos ->> 'marketing'` (select = leitura/escrita, insert/update = escrita, delete = superadmin) e `sincronizacoes` append-only (GRANT só select+insert) — AC-12
- [x] T006 Na mesma migration, `marketing.fn_metricas_periodo(date, date)` com recusa de período invertido e janela > 366 dias — AC-1, AC-2, AC-3
- [x] T007 Na mesma migration, `marketing.fn_receita_por_campanha(date, date)` `security definer` exigindo claim de `marketing` **e** `comercial` — AC-16, AC-17, AC-18
- [x] T008 Na mesma migration, `marketing.fn_registrar_entrada_anuncio(...)` e `marketing.fn_vincular_oportunidade(...)` com checagem de permissão no servidor — AC-14, AC-15
- [x] T009 Na mesma migration, `marketing.fn_token_meta()` lendo o Vault por nome fixo, `grant execute` só a `service_role` — AC-10
- [x] T010 Na mesma migration, gate `marketing.sso_indicadores_meta_gate` criado já aberto e conta de demonstração semeada — AC-19, AC-20
- [x] T011 Escrever `supabase/tests/marketing_indicadores_rls.test.sql` (pgTAP) com caso permitido **e** negado para leitura, escrita, idempotência do upsert, unicidade do vínculo e recusa da receita sem Comercial — AC-8, AC-9, AC-12, AC-15, AC-17

## Fase 3 — US1: indicadores por período (P1)

- [x] T012 [P] [US1] Escrever `apps/web/src/features/marketing/domain/periodo.test.ts` com os casos de atalho, período anterior e `problemaDoPeriodo` — AC-7
- [x] T013 [US1] Implementar `apps/web/src/features/marketing/domain/periodo.ts` — AC-7
- [x] T014 [P] [US1] Escrever `apps/web/src/features/marketing/domain/indicadores.test.ts` provando soma por nível, custo por lead indisponível sem leads e ordenação com `null` no fim — AC-1, AC-2, AC-3, AC-5
- [x] T015 [US1] Implementar `apps/web/src/features/marketing/domain/indicadores.ts` (`dividir`, `custo`, `somar`, `indicadores`, `arvoreDoRelatorio`, `ordenarPor`) — AC-1, AC-2, AC-3, AC-5
- [x] T016 [US1] Declarar as portas em `apps/web/src/features/marketing/application/marketing-gateway.ts` — AC-1, AC-16
- [x] T017 [US1] Implementar o adapter `apps/web/src/features/marketing/infrastructure/marketing-supabase.ts` sobre as RPCs — AC-1, AC-16
- [x] T018 [US1] Implementar `apps/web/src/features/marketing/application/marketing-queries.ts` com `marketingQueryKeys` e `keepPreviousData` no filtro de período — AC-7
- [x] T019 [US1] Implementar `apps/web/src/features/marketing/interfaces/IndicadoresMetaPage.tsx` com cartões, tabela hierárquica colapsável e os estados carregando/vazio/erro — AC-1, AC-2, AC-3, AC-4, AC-6

## Fase 4 — US2: sincronização idempotente (P2)

- [x] T020 [P] [US2] Escrever `supabase/functions/_shared/marketing/meta-ads.test.ts` cobrendo conversão de `spend` para centavos, soma de leads a partir de `actions` e determinismo da fixture — AC-8, AC-10
- [x] T021 [US2] Implementar `supabase/functions/_shared/marketing/meta-ads.ts` com `MetaAdsPort` **só de leitura**, `MetaAdsHttp` e `MetaAdsFixture` — AC-8, AC-10
- [x] T022 [US2] Criar `supabase/functions/_shared/marketing/fixtures/conta-demonstracao.json` determinística com datas relativas — AC-10
- [x] T023 [US2] Implementar `supabase/functions/marketing-sincronizar-meta/index.ts` (CORS → auth → Zod → autorização → upsert idempotente → resposta com `origem`) — AC-8, AC-9, AC-10, AC-12
- [x] T024 [US2] Gravar toda execução em `marketing.sincronizacoes`, inclusive a que falhou, e declarar a função em `supabase/config.toml` — AC-11
- [x] T025 [US2] Expor o disparo e a última sincronização na tela de indicadores (tarja de origem `demonstracao`) — AC-10, AC-11

## Fase 5 — US3: rastreio até a venda (P3)

- [x] T026 [P] [US3] Escrever `apps/web/src/features/marketing/domain/link-rastreado.test.ts` com montagem, leitura do token no caminho e na query, e token desconhecido devolvendo nulo — AC-13, AC-14
- [x] T027 [US3] Implementar `apps/web/src/features/marketing/domain/link-rastreado.ts` — AC-13, AC-14
- [x] T028 [P] [US3] Escrever `apps/web/src/features/marketing/domain/receita-campanha.test.ts` provando ordenação por receita e campanha sem atribuição preservada na lista — AC-16, AC-18
- [x] T029 [US3] Implementar `apps/web/src/features/marketing/domain/receita-campanha.ts` — AC-16, AC-18
- [x] T030 [US3] Implementar `apps/web/src/features/marketing/interfaces/ReceitaPorCampanhaPage.tsx` com a recusa por falta de Comercial traduzida para o usuário — AC-16, AC-17, AC-18
- [x] T031 [US3] Ligar geração de link rastreado e vínculo com oportunidade no adapter e nas queries — AC-13, AC-15

## Fase 6 — US4: o módulo sai do placeholder (P3)

- [x] T032 [US4] Declarar `MarketingView` e `MARKETING_NAV` em `apps/web/src/app/navegacao-sso.ts` — AC-19
- [x] T033 [US4] Trocar o placeholder pelo ramo `activeModulo === "marketing"` em `apps/web/src/app/HomePage.tsx`, com `RecursoNaoAtivado` quando a flag está desligada — AC-19, AC-20
- [x] T034 [US4] Declarar `VITE_SSO_MARKETING_INDICADORES_ENABLED` e `VITE_SSO_MARKETING_RECEITA_CAMPANHA_ENABLED` em `flags-sso.data.json`, `.env.example` e `netlify.toml` (`"true"`) — AC-19, AC-20

## Fase 7 — Fechamento

- [x] T035 Rodar `node scripts/lint-migrations.mjs`, `node scripts/check-edge-functions.mjs`, `node scripts/check-flags-declaradas.mjs`, os testes do que foi tocado e `pnpm build` em `apps/web`
- [x] T036 Abrir o PR contra `main` dizendo qual credencial da Meta falta e onde ela entra — PR #123

## Dependências

```
Fase 1 → Fase 2 → ┬→ Fase 3 (US1) ─┬→ Fase 4 (US2)
                  │                 └→ Fase 5 (US3)
                  └→ Fase 6 (US4, depende só de US1 existir)
                                      Fase 7 fecha tudo
```

US2 e US3 são independentes entre si: ambas dependem do schema (Fase 2) e da tela da US1 para
terem onde aparecer. As tasks marcadas `[P]` são os testes, que se escrevem em paralelo à leitura
do plano porque tocam arquivos diferentes.

## MVP

Fases 1–3 entregam valor sozinhas: schema com RLS provada e a tela de indicadores funcionando
sobre o que estiver gravado.

## SPEC_DEVIATION

Nenhuma aberta.

Registro de decisão que **não** é desvio, mas merece estar visível: o alcance agregado é a soma
dos alcances diários, exibido com o rótulo "Alcance (soma diária)" e a explicação de que não é
gente distinta do período (research.md D4). A spec nunca exigiu dedupe de alcance, e AC-2 cobra
igualdade entre níveis só para gasto, impressões, cliques e leads.
