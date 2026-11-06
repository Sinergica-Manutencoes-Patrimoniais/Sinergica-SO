---
name: "docs-adr-0177-diagnostico-lote-estrutura-md"
description: "Documento Sinérgica SO: ADR-0177 — Diagnóstico de lote de estrutura em staging"
alwaysApply: false
---

# ADR-0177 — Diagnóstico de lote de estrutura em staging

## Decisão

Preparar consulta paginada por lote e Cliente para apontar nome ausente, formato de código, código já presente, duplicidade literal de nome e referência de pai ausente, não encontrada, cíclica ou de tipo incompatível. A consulta não aprova, altera ou rejeita linhas. Autorização `cadastro.aprovar` é verificada no servidor; a função permanece revogada e a tela desligada até validação.

## Limites

Diagnóstico literal não comprova ausência de duplicidade e não resolve referências a cadastros oficiais externos ao lote. A pesquisa de código é restrita ao Cliente e não comprova unicidade global. Não valida classificação nem vínculos funcionais ou todos os casos de código/alias. O ciclo é percorrido apenas no lote, com limite conservador de profundidade. Aprovação precisa revalidar dados em transação; nenhuma consulta isolada é autorização para incorporar. Não testar/aplicar nesta rodada.
