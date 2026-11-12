---
name: "adr-1686-concorrencia-idempotencia-composicao-proposta"
description: "Decide fechar SEC-009/SEC-010: expected_versao/FOR UPDATE e request_id em fn_salvar_composicao_proposta/fn_duplicar_proposta"
alwaysApply: false
---

# ADR-1686 — Concorrência e idempotência na composição de proposta

## Estado

Aceito como direção; implementação é story própria (E01-S187), não parte da E01-S184. Nenhuma migration aplicada por este ADR.

## Contexto

A revisão adversarial da E01-S184 (2026-11-10, PR #73) encontrou dois achados médios em `comercial.fn_salvar_composicao_proposta` e `comercial.fn_duplicar_proposta` (migration 0184, E03-S04, 2026 anterior à S184), registrados em `docs/SECURITY_DEBT.md` como SEC-009 e SEC-010:

- **SEC-009:** `fn_salvar_composicao_proposta` lê a proposta sem `FOR UPDATE` e não recebe `expected_versao`. Duas edições concorrentes da mesma composição se sobrescrevem silenciosamente (last-write-wins), sem conflito explícito — ao contrário do padrão já estabelecido em `pcm.sso_editar_composicao_proposta` (migration 1572, E01-S184), que checa `versao_atual <> p_expected_versao` e recusa com `versao_obsoleta` (40001).
- **SEC-010:** nem `fn_salvar_composicao_proposta` nem `fn_duplicar_proposta` recebem `request_id`. Um retry de rede durante a "correção" de uma proposta terminal — fluxo que a própria E01-S184 passou a depender de `fn_duplicar_proposta` para a prova de AC-4 — pode criar duas cópias corrigidas da mesma proposta original, sem detecção nem conflito.

Estas duas funções são o núcleo de edição do módulo Comercial inteiro (usadas por `PropostaEditorPage.tsx`, não só pelo fluxo de correção da S184), portanto o conserto tem blast radius maior que uma correção pontual: muda o contrato de duas RPCs amplamente chamadas e exige UI que carregue/retransmita a versão esperada e trate o novo erro de conflito.

## Decisão

- Tratar como story própria (**E01-S187**), não como parte da E01-S184, dado o blast radius.
- `fn_salvar_composicao_proposta`: adicionar `p_expected_versao` obrigatório; `SELECT ... FOR UPDATE` na leitura inicial da proposta; recusar com `versao_obsoleta` (40001) quando `versao_atual <> p_expected_versao`, mesmo padrão de `pcm.sso_editar_composicao_proposta` (1572). Migration aditiva: nova função/assinatura, sem remover a antiga até todos os chamadores migrarem (ver "Compatibilidade").
- `fn_duplicar_proposta`: adicionar `p_request_id` obrigatório, com `pg_advisory_xact_lock` e tabela de registro de comando (mesmo padrão de `pcm.sso_edicoes_composicao_escopadas`, migration 1572) — replay idêntico retorna o resultado anterior; payload divergente é conflito (23505).
- `PropostaEditorPage.tsx` passa a carregar e retransmitir `versao_atual`/`request_id`, trata o novo erro de conflito explicitamente (recarregar e avisar o usuário, não falhar silenciosamente) e usa `crypto.randomUUID()` para o `request_id` de cada ação de salvar/duplicar.
- Compatibilidade: manter as funções antigas (sem `expected_versao`/`request_id`) existindo até a UI migrar por completo nesta mesma story; não há consumidor externo documentado além da própria web app.

## Consequências

Fecha SEC-009 e SEC-010 (atualizar `docs/SECURITY_DEBT.md` quando a implementação estiver provada). Exige pgTAP permitido/negado para o novo conflito de versão e para o replay por `request_id`, e teste de UI/e2e cobrindo o aviso de conflito. Revisão adversarial obrigatória antes de PASS (tier arquitetural: função núcleo de um módulo em produção). Risco aceito enquanto a story não roda: edição concorrente continua last-write-wins e correção duplicada continua possível por retry — mitigado hoje pelo volume baixo de uso simultâneo do editor de propostas (observação qualitativa, não medida).
