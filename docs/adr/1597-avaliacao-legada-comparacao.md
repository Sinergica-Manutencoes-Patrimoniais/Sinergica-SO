---
name: "docs-adr-1597-avaliacao-legada-comparacao-md"
description: "Documento Sinérgica SO: ADR 1597: avaliação legada na comparação de impacto"
alwaysApply: false
---

# ADR 1597: avaliação legada na comparação de impacto

Avaliação recebida na ocorrência legada vinculada integra a fotografia conferida pelo PCM e sua comparação transacional. A ausência não altera fotografias históricas; quando existente, a informação de presença é exibida sem expor conteúdo. A leitura mantém trava compartilhada para evitar mudança concorrente antes do commit. Recibos anteriores continuam sujeitos às regras de replay existentes.
