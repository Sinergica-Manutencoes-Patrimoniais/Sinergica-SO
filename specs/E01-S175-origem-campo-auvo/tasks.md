# Tarefas — E01-S175

Especificada; todas pendentes para Terra. Dependências: E01-S167, E01-S170. Testes antes da implementação de cada regra. Sem rede real por padrão.

## Preparação e fundação

- [ ] T001 Conferir fontes, ADR-0026/0027/0028 e contrato compartilhado; registrar matriz de capacidade e reuso em `specs/E01-S175-origem-campo-auvo/research.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T002 Criar testes pgTAP de unicidade, requestId, RLS FORCE e permissão permitida/negada em `supabase/tests/E01-S175_integracao.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Implementar schema/RPCs aditivas em `supabase/migrations/`, com requestId único, expectedRevision, histórico e policies conforme `specs/E01-S175-origem-campo-auvo/data-model.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## US1 — Ingerir tarefa com referência de Chamado

- [ ] T004 [US1] Escrever testes de referência válida, mesmo Cliente e preservação de execução em `supabase/functions/_shared/auvo/os-from-task.test.ts` (AC-1).
- [ ] T005 [US1] Implementar referência válida, mesmo Cliente e preservação de execução em `supabase/functions/_shared/auvo/os-from-task.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-1).
- [ ] T006 [US1] Escrever testes de provisório e isolamento, referência inválida e Cliente desconhecido em `supabase/functions/_shared/auvo/origem-campo.test.ts` (AC-2).
- [ ] T007 [US1] Implementar provisório e isolamento, referência inválida e Cliente desconhecido em `supabase/functions/_shared/auvo/origem-campo.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-2).

## US2 — Conciliar contêiner sem apagar execução

- [ ] T008 [US2] Escrever testes de confirmação/correção de provisório e permissão em `apps/web/src/features/pcm/application/triagem-campo.test.ts` (AC-3).
- [ ] T009 [US2] Implementar confirmação/correção de provisório e permissão em `apps/web/src/features/pcm/application/triagem-campo.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-3).
- [ ] T010 [US2] Escrever testes de união, duplicidade e cancelamento não destrutivos em `supabase/functions/pcm-triagem-campo/index.test.ts` (AC-4).
- [ ] T011 [US2] Implementar união, duplicidade e cancelamento não destrutivos em `supabase/functions/pcm-triagem-campo/index.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-4).

## US3 — Reprocessar e distinguir levantamento

- [ ] T012 [US3] Escrever testes de deduplicação transacional e precedência origem/decisão PCM em `supabase/functions/_shared/auvo/origem-campo-inbox.test.ts` (AC-5).
- [ ] T013 [US3] Implementar deduplicação transacional e precedência origem/decisão PCM em `supabase/functions/_shared/auvo/origem-campo-inbox.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-5).
- [ ] T014 [US3] Escrever testes de classificação levantamento, staging e ausência de cadastro automático em `supabase/functions/_shared/auvo/levantamento-recepcao.test.ts` (AC-6).
- [ ] T015 [US3] Implementar classificação levantamento, staging e ausência de cadastro automático em `supabase/functions/_shared/auvo/levantamento-recepcao.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-6).

## Integração e fechamento

- [ ] T016 Testar ações/estados da UI com doubles em `apps/web/src/features/pcm/application/e01-s175-integration.test.ts` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T017 Integrar consultas paginadas e ações em `apps/web/src/features/pcm/application/operacao-queries.ts` e `apps/web/src/features/pcm/pages/TriagemCampoPage.tsx`, com invalidação TanStack Query, foco e carregando/vazio/erro/sucesso (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T018 Registrar resultados CT, revisão adversarial e CI/db-tests em `specs/E01-S175-origem-campo-auvo/quickstart.md`; manter gate operacional fechado até etapa autorizada (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependências, paralelismo e estratégia

Preparação/fundação precedem US1. US2 usa objetos de US1; US3 usa resultados anteriores e pode preparar fixtures independentemente. Não paralelizar migrations nem arquivos compartilhados. MVP demonstrável: US1 com doubles; aprovação de implementação exige todas as fases. Cada AC tem teste dedicado e implementação de regra; tarefas gerais não substituem cobertura específica.
