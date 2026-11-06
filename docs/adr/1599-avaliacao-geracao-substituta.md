---
name: "docs-adr-1599-avaliacao-geracao-substituta-md"
description: "Documento Sinérgica SO: ADR 1599: avaliação tardia antes da geração substituta"
alwaysApply: false
---

# ADR 1599: avaliação tardia antes da geração substituta

A avaliação que chega após a retirada da fila é evidência de execução da origem. Antes de gerar uma substituição por Calendário ou Visita, o sistema reconfere todas as pontes conhecidas da identidade anterior e exige reconciliação quando houver avaliação. A trava compartilhada serializa a verificação com a chegada do retorno. Nenhum histórico é alterado; replay existente mantém sua semântica.
