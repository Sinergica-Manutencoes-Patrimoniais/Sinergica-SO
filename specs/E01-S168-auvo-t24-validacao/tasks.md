# Tarefas — E01-S168

**SPEC_DEVIATION (ainda verdadeira, confirmada em 2026-11-10 madrugada):** o livro experimental T−24 em 1309 possui reserva própria sem vínculo com `pcm.auvo_sync_outbox`. Confirmado por leitura real: `supabase/functions/_shared/auvo/orquestracao-t24.ts` só é importado por `fornecedor-t24.ts`/`repositorio-t24.ts`/`payload-t24.ts`/`lote-t24.ts` (outros arquivos `_shared/auvo/*`) — **nenhuma edge function (`index.ts`) o importa**. Não existe `pcm-auvo-orquestrar`. O motor T-24 automático está implementado e testado no SQL mas é código morto do ponto de vista de produtor/deploy real. Manter sem produtor, execução ou ativação até integração compatível; não considerar T006/T007 concluídas.

**Correção de auditoria (2026-11-10, madrugada):** o cabeçalho "todas pendentes" e as 22 tasks `[ ]` estavam desatualizados — a arquitetura real diverge dos caminhos planejados (não existe `pcm-auvo-orquestrar/index.ts` nem a maioria dos arquivos `_shared/auvo/*.ts` nomeados no plano original), mas a REGRA de negócio por trás de cada AC existe de verdade em outro lugar: motor real em `supabase/functions/_shared/auvo/` (40+ arquivos: `orquestracao-t24.ts`, `composicao-t24.ts`, `horario-t24.ts`, `busca-identidade-t24.ts`, `lote-t24.ts`, `fornecedor-t24.ts`, `http-t24.ts`, `payload-t24.ts`, `repositorio-t24.ts`), 20 migrations SQL (1309→1508), 15 arquivos pgTAP reais na seleção oficial de `db-tests`, e UI real (`Workspace.tsx` → `IntencaoLocalEnvio.tsx` → `CandidatasT24.tsx`/`CancelarCandidataT24.tsx`/`RespostasTardiasT24.tsx`) chamando RPCs reais (`sso_t24_listar_candidatas`, `sso_t24_diagnosticar_candidata`, `sso_t24_produzir_preventiva/corretiva`, grants confirmados: `sso_t24_listar_candidatas` → `authenticated` em 1313:21-22; `sso_t24_iniciar_efeito`/`sso_t24_confirmar_efeito` → `service_role` em 1417:19-20, correto para motor server-to-server). Caminho que funciona hoje é manual: PCM aciona pela UI, atrás de feature flags `VITE_SSO_PRODUTOR_T24_*`, todas fechadas por padrão. **Nenhum disparo HTTP real de Auvo encontrado** nesta auditoria — gates fechados, nada indica rede real ligada.
  - **Gaps reais confirmados (não apenas rastreamento desatualizado):** (1) T006/T007 — falta o produtor/cron real ligando `orquestracao-t24.ts` a uma edge function publicada (hoje é código morto de deploy); (2) T018/T019 (AC-8, validação PCM pós-conclusão) — `apps/web/.../application/validacao-os.ts` **ausente**; pgTAP `_opcional_aprovacao.test.sql` sugere a regra existir no SQL, mas não há camada de aplicação TS localizada sob nenhum nome correspondente.
  - **T001-T005, T008-T017, T020-T021 (exceto as duas lacunas acima):** REAL-E-TESTADO com ressalvas de cobertura TS específica — `horario-t24.ts`/`busca-identidade-t24.ts`/`contrato-operacional.ts`/`intencoes.ts`/`reconciliar-task.ts` existem mas sem teste `.test.ts` dedicado colocado ao lado (cobertura real está do lado SQL/pgTAP, não confirmada do lado TS unitário) — marcar como feito com essa ressalva, não como pendente.
  - T022 (quickstart/CI/homologação) genuinamente pendente, mesmo padrão de gap visto em todas as stories auditadas nesta sessão.

Dependências: E01-S167, E01-S171, E01-S170. Testes antes da implementação de cada regra. Sem rede real por padrão.

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
