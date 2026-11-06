---
name: "docs-adr-1587-reconciliacao-legada-inerte-md"
description: "Documento Sinérgica SO: ADR 1587 — Declaração PCM sobre ocorrência legada inerte"
alwaysApply: false
---

# ADR 1587 — Declaração PCM sobre ocorrência legada inerte

## Contexto
Uma ocorrência legada futura pode ser preparada antes da vigência de uma escolha aprovada `somente_sso`. A existência da linha mantém a guarda conservadora; excluí-la apagaria histórico e ignorá-la nas telas criaria pendência indevida.

## Decisão
Após a vigência, o PCM pode registrar declaração auditada e idempotente para a ocorrência e o selo específicos, após prévia comparada e validação transacional de Cliente, versão, regra, identidade, vigência e ausência de execução ou OS. A linha legada permanece.

## Limites
O registro é preparatório: não altera 1724, não remove a guarda 1045, não retira a linha das listas nem autoriza OS ou Auvo. Integração de indicadores e escritores depende de revisão e prova separadas. Se fontes ou efeitos estiverem incertos, a declaração falha fechada.
