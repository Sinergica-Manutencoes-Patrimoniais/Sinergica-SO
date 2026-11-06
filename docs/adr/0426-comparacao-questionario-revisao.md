---
name: "docs-adr-0426-comparacao-questionario-revisao-md"
description: "Documento Sinérgica SO: ADR-0426 — Comparação conservadora de questionário"
alwaysApply: false
---

# ADR-0426 — Comparação conservadora de questionário

Status: preparada, gate fechado, não aplicada nem homologada. A consulta localiza o snapshot aprovado original pela comparação revisionada e a Rotina de rascunho pela identidade lógica; compara a referência e, quando possível, o JSON integral histórico com a fonte atual, sem projetar nem eliminar campos desconhecidos. Uma diferença pode ser apenas metadado; igualdade é somente fotografia da fonte mutável.

Rotina ausente, snapshot ou fonte indisponível e estruturas desconhecidas são não comparáveis/indeterminados, não equivalência. Não altera snapshots, questionários, OS ou ocorrência, nem aprova a revisão; impacto operacional continua pendente. Requer testes e revisão adversarial antes de ativação.
