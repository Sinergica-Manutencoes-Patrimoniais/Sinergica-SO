---
name: "docs-adr-1581-escolha-legada-avaliacao-revisao-md"
description: "Documento Sinérgica SO: ADR 1581 — Escolha legada explícita na avaliação de revisão"
alwaysApply: false
---

# ADR 1581 — Escolha legada explícita na avaliação de revisão

## Contexto
A avaliação de fontes contabiliza como pendente toda ocorrência legada sem ponte, mesmo quando o PCM escolheu preservar somente o ciclo legado específico em rascunho.

## Decisão
A avaliação considera essa ocorrência tratada apenas se houver uma única escolha atual `somente_legado` para o mesmo Cliente, Plano, rascunho e índice, com foto integral revalidada e ocorrência ainda prevista, pendente, sem envio ou OS. A selagem permanece obrigatória no token de aprovação e revalida vigência e fontes. Não se deduz relação por data ou alvo.

## Limites
Histórico executado, fontes ambíguas ou obsoletas e pares sem escolha continuam exigindo reconciliação. A guarda 1045 permanece ativa; este ajuste não prova cobertura integral nem ausência de fontes externas.
