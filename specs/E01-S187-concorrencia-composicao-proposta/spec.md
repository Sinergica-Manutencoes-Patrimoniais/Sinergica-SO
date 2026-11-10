# Feature Specification: E01-S187 — Concorrência e idempotência na composição de proposta

**Feature Branch**: a definir ao iniciar implementação
**Created**: 2026-11-10
**Status**: Especificada — implementação não iniciada
**Input**: Achados SEC-009/SEC-010 da revisão adversarial da E01-S184 (2026-11-10, PR #73); ADR-1686.
**Dependências**: Independente das demais stories do programa SSO Terra; toca função núcleo de E03-S04 (Comercial), não E01-S184.

## User Scenarios & Testing

### User Story 1 — Conflito explícito ao salvar composição concorrente (Priority: P1)

Duas pessoas (ou duas abas da mesma pessoa) editando a composição da mesma proposta não devem se sobrescrever silenciosamente.

**Why this priority**: Hoje é last-write-wins sem aviso — perda de edição real, não hipotética.
**Independent Test**: Duas sessões carregam a mesma proposta na versão N; a primeira salva (vira N+1); a segunda tenta salvar ainda com N.

**Acceptance Scenarios**:

1. **AC-1** — **Given** proposta na versão N carregada por duas sessões, **When** a primeira salva composição (versão vira N+1) e a segunda tenta salvar informando ainda N, **Then** a segunda é recusada com conflito explícito (`versao_obsoleta`, 40001), sem sobrescrever o que a primeira gravou.
2. **AC-2** — **Given** o mesmo conflito do AC-1, **When** a UI recebe o erro, **Then** ela avisa a pessoa e oferece recarregar a composição atual, sem perder o texto que a pessoa ainda não salvou (preservado em memória local para nova tentativa).

### User Story 2 — Duplicar proposta não duplica por retry (Priority: P1)

A "correção" de uma proposta terminal (E01-S184/AC-4) duplica via `fn_duplicar_proposta`; um retry de rede não pode criar duas cópias.

**Why this priority**: Vira o caminho oficial de correção comercial; duplicidade silenciosa confunde Cliente e contabilidade.
**Independent Test**: Chamar duplicar duas vezes com o mesmo `request_id`.

**Acceptance Scenarios**:

1. **AC-3** — **Given** uma chamada de duplicar com `request_id` X já confirmada, **When** repetir com o mesmo X e mesmos parâmetros, **Then** devolve o mesmo resultado anterior, sem criar segunda proposta.
2. **AC-4** — **Given** uma chamada de duplicar com `request_id` X já confirmada, **When** repetir com o mesmo X e parâmetros diferentes, **Then** recusa como conflito (`request_id_conflitante`, 23505).

### Edge Cases

- Sessão sem `versao_atual` carregada (cliente antigo/cache) não deve conseguir salvar sem informar a versão — UI sempre carrega antes de permitir editar.
- Duas abas da mesma pessoa contam como "duas sessões" para este efeito; não há tratamento especial por identidade de usuário.

## Requirements

### Functional Requirements

- **FR-001**: `comercial.fn_salvar_composicao_proposta` exige `expected_versao` e usa `SELECT ... FOR UPDATE` na leitura inicial; recusa com `versao_obsoleta` (40001) se divergente — mesmo padrão de `pcm.sso_editar_composicao_proposta` (migration 1572).
- **FR-002**: `comercial.fn_duplicar_proposta` exige `request_id`; replay idêntico retorna resposta anterior, payload divergente é conflito (23505) — mesmo padrão de `pcm.sso_edicoes_composicao_escopadas` (migration 1572).
- **FR-003**: Migration aditiva: nova assinatura/função coexiste com a antiga até todos os chamadores migrarem nesta mesma story; não editar migration 0184 aplicada.
- **FR-004**: `PropostaEditorPage.tsx` carrega e retransmite `versao_atual`, gera `request_id` por ação de salvar/duplicar, e trata o novo erro de conflito com aviso explícito e opção de recarregar.

### Key Entities

`comercial.propostas` (versão atual); `comercial.proposta_versoes` (snapshot imutável, inalterado por esta story); registro de comando idempotente para duplicar (mesmo padrão de `pcm.sso_edicoes_composicao_escopadas`).

## Success Criteria

- **SC-001**: AC-1 a AC-4 demonstráveis em pgTAP com duas "sessões" simuladas (padrão já usado no repositório para concorrência em uma transação de teste).
- **SC-002**: Repetir o mesmo `request_id` de duplicar não cria segunda proposta nem segunda versão.
- **SC-003**: `PropostaEditorPage.tsx` nunca perde silenciosamente uma edição por conflito de versão.

## Assumptions

- Único consumidor de `fn_salvar_composicao_proposta`/`fn_duplicar_proposta` é a própria web app (`PropostaEditorPage.tsx`); nenhuma integração externa documentada as chama diretamente.
- Funções antigas (sem `expected_versao`/`request_id`) ficam desativadas só quando a UI nova estiver completa, nesta mesma story — sem janela de dois contratos em produção simultaneamente.

## Fora de escopo

Reformar motor de preço ou regras de piso/margem (ADR-1686 não toca `comercial.fn_proposta_valida_piso`/`fn_forcar_preco_abaixo_piso`). Não cria novo fluxo de "revisão" de proposta além do já existente (`rascunho`/`em_revisao`/`aprovada`). Nesta etapa, somente especificação; nenhuma migration aplicada, deploy ou tarefa Auvo real.
