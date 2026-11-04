# ADR-0124 — Alteração e cancelamento de previsão de despesa

## Estado

Proposta para E01-S180; depende da ADR-0102, sem aplicação ou homologação.

## Decisão

Comando modifica somente data, descrição e valor previsto de despesa ativa sem realizado, ou a cancela com motivo. Cada transição registra revisão, ator, motivo, valores anterior e posterior e requestId de forma atômica, sem excluir registros, comprovantes ou criar lançamento financeiro. Visita e Cliente derivam do registro; autorização `despesa_visita.gerir` é validada no servidor após os locks. Retentativa idêntica retorna resultado anterior e revisão divergente conflita.

As RPCs permanecem sem EXECUTE a papéis da aplicação. Ausência de valor realizado não prova, por si só, ausência de contabilização ou vínculo financeiro. A futura habilitação exige verificação transacional de todos os vínculos financeiros, anexos e rateios, prevenção de concorrência com sua criação, e uso do fluxo de estorno em despesas efetivadas. Não descartar dados na reversão; revogar funções e preservar histórico.

## Gates

CI com pgTAP, permissões e revogação concorrente, duas sessões, idempotência, integridade cross-Cliente, anexos privados e fechamento financeiro; revisão adversarial e confirmação dos contratos de integração. Não aplicar ou ativar flag antes dos gates.
