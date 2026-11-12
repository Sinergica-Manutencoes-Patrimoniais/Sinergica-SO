# Tasks — E01-S187: Concorrência e idempotência na composição de proposta

**Status**: Especificada (2026-11-10); implementação não iniciada.
**Input**: spec.md, ADR-1686. plan.md/research.md/data-model.md/contracts/quickstart.md ainda não escritos — escrever antes de T003 (Spec Kit completo, consultando ADR-1686, migration 0184 e 1572 como referência de padrão).
**Dependências**: Independente; toca função núcleo de Comercial (E03-S04) usada fora do programa SSO Terra — coordenar owner antes de codar.
**Tests**: Obrigatórios por AC; escrever e observar falha antes de implementar.

## Phase 1 — Setup

- [ ] T001 Escrever plan.md/research.md/data-model.md/contracts/commands.md/quickstart.md a partir de ADR-1686; mapear todos os chamadores atuais de `fn_salvar_composicao_proposta`/`fn_duplicar_proposta` (grep em `apps/web/src/features/comercial`) antes de mudar assinatura (AC-1, AC-2, AC-3, AC-4).

## Phase 2 — US1: Conflito explícito ao salvar composição concorrente

**Independent Test**: Duas sessões carregam a mesma proposta na versão N; a primeira salva, a segunda tenta salvar ainda com N.

- [ ] T002 [US1] Escrever pgTAP permitido/negado para `expected_versao`/`FOR UPDATE` em `supabase/tests/E01-S187_concorrencia_composicao_proposta_us1.test.sql`, simulando duas "sessões" na mesma transação de teste (padrão já usado em testes de concorrência do repositório) (AC-1).
- [ ] T003 [US1] Migration aditiva: nova função `comercial.fn_salvar_composicao_proposta_segura` (ou equivalente) com `p_expected_versao` + `FOR UPDATE`; manter a função antiga até a UI migrar (AC-1).
- [ ] T004 [US1] Escrever teste falho de `PropostaEditorPage.tsx` para tratar o novo erro de conflito (aviso + oferecer recarregar, preservando o texto não salvo) (AC-2).
- [ ] T005 [US1] Implementar em `PropostaEditorPage.tsx`: carregar/retransmitir `versao_atual`, tratar conflito explícito (AC-2).

## Phase 3 — US2: Duplicar proposta não duplica por retry

**Independent Test**: Chamar duplicar duas vezes com o mesmo `request_id`.

- [ ] T006 [US2] Escrever pgTAP permitido/negado de replay/conflito por `request_id` em `supabase/tests/E01-S187_concorrencia_composicao_proposta_us2.test.sql`, mesmo padrão de `pcm.sso_edicoes_composicao_escopadas` (1572) (AC-3, AC-4).
- [ ] T007 [US2] Migration aditiva: nova função `comercial.fn_duplicar_proposta_segura` (ou equivalente) com `p_request_id` + tabela de registro de comando idempotente; manter a função antiga até a UI migrar (AC-3, AC-4).
- [ ] T008 [US2] Implementar em `PropostaEditorPage.tsx`: gerar `request_id` (`crypto.randomUUID()`) por ação de duplicar (AC-3, AC-4).

## Phase 4 — Integração e evidências

- [ ] T009 Revogar execução das funções antigas de `authenticated` só depois de confirmar que nenhum chamador restante as usa (grep + teste de integração) (AC-1, AC-2, AC-3, AC-4).
- [ ] T010 Cobrir jornada crítica (conflito de versão avisado na UI, duplicar idempotente) em e2e dedicado ou extensão de `comercial-proposta-pdf-portal.spec.ts` (AC-1, AC-2, AC-3, AC-4).
- [ ] T011 Executar quickstart, revisão adversarial e registrar comandos/resultados/ressalvas antes de PASS; atualizar `docs/SECURITY_DEBT.md` (SEC-009/SEC-010 → mitigado, com evidência) (AC-1, AC-2, AC-3, AC-4).

## Dependencies & Execution Order

T001 antes de tudo. US1 e US2 tocam a mesma área (`comercial/pages/PropostaEditorPage.tsx`) — não paralelizar. T009 (revogar função antiga) só depois de T005/T008 confirmados em produção.
