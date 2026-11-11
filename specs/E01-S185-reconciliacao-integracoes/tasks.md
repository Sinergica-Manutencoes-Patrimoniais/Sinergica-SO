# Tarefas — E01-S185

**Auditoria de código em 2026-11-10 (madrugada):** confirmado por leitura real (fork somente-leitura) — esta é a **única story do programa (S165-S186) genuinamente 0% implementada**. `grep -rln "E01-S185" supabase/migrations/*.sql` → zero resultados; nenhuma tabela "ocorrência de reconciliação" existe; `application/reconciliacao.ts` não existe; `pages/ReconciliacaoIntegracoesPage.tsx` não existe. Os ~14 arquivos TS com "Reconciliar" no nome (`ReconciliarLegado.tsx`, `ReconciliarQuarentenaCsv.tsx` etc.) são de reconciliação de **importação de planilha/cadastro legado** (feature homônima, não relacionada). Nenhum disparo HTTP real de Auvo encontrado nesta auditoria.

**SPEC_DEVIATION descoberto nesta auditoria (bloqueia T015 como está escrita):** T015 planeja criar `supabase/functions/integracoes-verificar/index.ts`, mas esse nome **já existe** — pertence a E01-S165 (varredura periódica do Plano de Manutenção, `docs/adr/1422-varredura-integracoes-por-fonte.md`, flag `SSO_VARREDURA_FILA_PERIODICA_ENABLED`), não a esta story. Mesma colisão potencial em `integracoes-agendar-fila`/`-origens`/`-os` e `integracoes-verificar-os` (todos de S165). Antes de implementar T015: decidir com Lucas/Fabrício se (a) a varredura periódica de S185 ganha nome diferente (ex. `integracoes-reconciliar-verificar` ou prefixo `pcm-reconciliacao-*`, consistente com o padrão `pcm-auvo-*`/`pcm-cronograma-*` já usado por outras stories), ou (b) a função existente de S165 é estendida para também cobrir o escopo de reconciliação do AC-6 desta story — não decidir isso sozinho em sessão autônoma, é escolha de arquitetura com duas integrações distintas no mesmo nome. T009 (`integracoes-reconciliar/index.ts`) não colide com nada existente, pode seguir como planejado.

Especificada; todas pendentes para Terra. Dependências: E01-S168, E01-S175, E01-S181, E01-S182 — por esta mesma auditoria (2026-11-10), as 4 já têm código real substancial (ver seus próprios `tasks.md`), mas S168 e S175 têm gaps reais confirmados (T-24 sem produtor real; pgTAP quase nulo) que também merecem atenção antes de uma integração de verdade com S185. Testes antes da implementação de cada regra. Sem rede real por padrão.

## Preparação e fundação

- [ ] T001 Conferir fontes, ADR-0026/0027/0028 e contrato compartilhado; registrar matriz de capacidade e reuso em `specs/E01-S185-reconciliacao-integracoes/research.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T002 Criar testes pgTAP de unicidade, requestId, RLS FORCE e permissão permitida/negada em `supabase/tests/E01-S185_integracao.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Implementar schema/RPCs aditivas em `supabase/migrations/`, com requestId único, expectedRevision, histórico e policies conforme `specs/E01-S185-reconciliacao-integracoes/data-model.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## US1 — Identificar objeto, causa e impacto

- [ ] T004 [US1] Escrever testes de consulta consolidada e isolamento de dados/custos em `apps/web/src/features/pcm/application/reconciliacao.test.ts` (AC-1).
- [ ] T005 [US1] Implementar consulta consolidada e isolamento de dados/custos em `apps/web/src/features/pcm/application/reconciliacao.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-1).
- [ ] T006 [US1] Escrever testes de estados fiéis, histórico e minimização em `supabase/functions/_shared/integracoes/projecao.test.ts` (AC-2).
- [ ] T007 [US1] Implementar estados fiéis, histórico e minimização em `supabase/functions/_shared/integracoes/projecao.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-2).

## US2 — Recuperar sem repetir efeitos

- [ ] T008 [US2] Escrever testes de retry delegado, concorrência e permissão em `supabase/functions/integracoes-reconciliar/index.test.ts` (AC-3).
- [ ] T009 [US2] Implementar retry delegado, concorrência e permissão em `supabase/functions/integracoes-reconciliar/index.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-3).
- [ ] T010 [US2] Escrever testes de incerteza e decisão de duplicidades em `supabase/functions/_shared/integracoes/reconciliar.test.ts` (AC-4).
- [ ] T011 [US2] Implementar incerteza e decisão de duplicidades em `supabase/functions/_shared/integracoes/reconciliar.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-4).

## US3 — Tratar conflito e prevenir regressão

- [ ] T012 [US3] Escrever testes de evento fora de ordem e precedência de decisões em `supabase/functions/_shared/integracoes/conflitos.test.ts` (AC-5).
- [ ] T013 [US3] Implementar evento fora de ordem e precedência de decisões em `supabase/functions/_shared/integracoes/conflitos.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-5).
- [ ] T014 [US3] Escrever testes de varredura, tentativa presa e fechamento rastreável em `supabase/functions/integracoes-verificar/index.test.ts` (AC-6).
- [ ] T015 [US3] Implementar varredura, tentativa presa e fechamento rastreável em `supabase/functions/integracoes-verificar/index.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-6).

## Integração e fechamento

- [ ] T016 Testar ações/estados da UI com doubles em `apps/web/src/features/pcm/application/e01-s185-integration.test.ts` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T017 Integrar consultas paginadas e ações em `apps/web/src/features/pcm/application/operacao-queries.ts` e `apps/web/src/features/pcm/pages/ReconciliacaoIntegracoesPage.tsx`, com invalidação TanStack Query, foco e carregando/vazio/erro/sucesso (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T018 Registrar resultados CT, revisão adversarial e CI/db-tests em `specs/E01-S185-reconciliacao-integracoes/quickstart.md`; manter gate operacional fechado até etapa autorizada (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependências, paralelismo e estratégia

Preparação/fundação precedem US1. US2 usa objetos de US1; US3 usa resultados anteriores e pode preparar fixtures independentemente. Não paralelizar migrations nem arquivos compartilhados. MVP demonstrável: US1 com doubles; aprovação de implementação exige todas as fases. Cada AC tem teste dedicado e implementação de regra; tarefas gerais não substituem cobertura específica.
