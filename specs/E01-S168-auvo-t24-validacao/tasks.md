# Tarefas — E01-S168

**SPEC_DEVIATION:** o livro experimental T−24 em 1309 possui reserva própria sem vínculo com `pcm.auvo_sync_outbox`, embora o plano exija um único fluxo. Manter sem produtor, execução ou ativação até integração compatível e revisão dos consumidores legados; não considerar T003/T007/T013 concluídas.

Especificada; todas pendentes para Terra. Dependências: E01-S167, E01-S171, E01-S170. Testes antes da implementação de cada regra. Sem rede real por padrão.

## Preparação e fundação

- [ ] T001 Conferir fontes, ADR-0026/0027/0028 e contrato compartilhado; registrar matriz de capacidade e reuso em `specs/E01-S168-auvo-t24-validacao/research.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8).
- [ ] T002 Criar testes pgTAP de unicidade, requestId, RLS FORCE e permissão permitida/negada em `supabase/tests/E01-S168_integracao.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8).
- [ ] T003 Implementar schema/RPCs aditivas em `supabase/migrations/`, com requestId único, expectedRevision, histórico e policies conforme `specs/E01-S168-auvo-t24-validacao/data-model.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8).

## US1 — Confirmar e enviar no momento correto

- [ ] T004 [US1] Escrever testes de confirmação PCM e ciência configurável em `apps/web/src/features/pcm/domain/auvo-elegibilidade.test.ts` (AC-1).
- [ ] T005 [US1] Implementar confirmação PCM e ciência configurável em `apps/web/src/features/pcm/domain/auvo-elegibilidade.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-1).
- [ ] T006 [US1] Escrever testes de janela T−24 com relógio controlado e timezone em `supabase/functions/pcm-auvo-orquestrar/index.test.ts` (AC-2).
- [ ] T007 [US1] Implementar janela T−24 com relógio controlado e timezone em `supabase/functions/pcm-auvo-orquestrar/index.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-2).
- [ ] T008 [US1] Escrever testes de gate fechado e read-back crítico por categoria em `supabase/functions/_shared/auvo/contrato-operacional.test.ts` (AC-3).
- [ ] T009 [US1] Implementar gate fechado e read-back crítico por categoria em `supabase/functions/_shared/auvo/contrato-operacional.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-3).

## US2 — Reprogramar e recuperar sem duplicar

- [ ] T010 [US2] Escrever testes de mesma tarefa, Demanda sem data e continuação em `supabase/functions/_shared/auvo/intencoes.test.ts` (AC-4).
- [ ] T011 [US2] Implementar mesma tarefa, Demanda sem data e continuação em `supabase/functions/_shared/auvo/intencoes.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-4).
- [ ] T012 [US2] Escrever testes de serialização, fence, cancelamento durante envio e resposta tardia em `supabase/functions/_shared/auvo/serializacao.test.ts` (AC-5).
- [ ] T013 [US2] Implementar serialização, fence, cancelamento durante envio e resposta tardia em `supabase/functions/_shared/auvo/serializacao.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-5).
- [ ] T014 [US2] Escrever testes de resultado incerto e zero/um/múltiplos candidatos em `supabase/functions/_shared/auvo/reconciliar-task.test.ts` (AC-6).
- [ ] T015 [US2] Implementar resultado incerto e zero/um/múltiplos candidatos em `supabase/functions/_shared/auvo/reconciliar-task.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-6).

## US3 — Validar execução no PCM

- [ ] T016 [US3] Escrever testes de inbox ordenada e regressão PMOC sem duplicidade em `supabase/functions/pcm-auvo-webhook/index.test.ts` (AC-7).
- [ ] T017 [US3] Implementar inbox ordenada e regressão PMOC sem duplicidade em `supabase/functions/pcm-auvo-webhook/index.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-7).
- [ ] T018 [US3] Escrever testes de validação PCM, Não OK, obrigatórios e permissões em `apps/web/src/features/pcm/application/validacao-os.test.ts` (AC-8).
- [ ] T019 [US3] Implementar validação PCM, Não OK, obrigatórios e permissões em `apps/web/src/features/pcm/application/validacao-os.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-8).

## Integração e fechamento

- [ ] T020 Testar ações/estados da UI com doubles em `apps/web/src/features/pcm/application/e01-s168-integration.test.ts` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8).
- [ ] T021 Integrar consultas paginadas e ações em `apps/web/src/features/pcm/application/operacao-queries.ts` e `apps/web/src/features/pcm/components/PreventivasWorkspace.tsx`, com invalidação TanStack Query, foco e carregando/vazio/erro/sucesso (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8).
- [ ] T022 Registrar resultados CT, revisão adversarial e CI/db-tests em `specs/E01-S168-auvo-t24-validacao/quickstart.md`; manter gate operacional fechado até etapa autorizada (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8).

## Dependências, paralelismo e estratégia

Preparação/fundação precedem US1. US2 usa objetos de US1; US3 usa resultados anteriores e pode preparar fixtures independentemente. Não paralelizar migrations nem arquivos compartilhados. MVP demonstrável: US1 com doubles; aprovação de implementação exige todas as fases. Cada AC tem teste dedicado e implementação de regra; tarefas gerais não substituem cobertura específica.
