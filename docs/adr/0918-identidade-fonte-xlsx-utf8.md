---
name: "docs-adr-0918-identidade-fonte-xlsx-utf8-md"
description: "Documento Sinérgica SO: ADR-0918 — Identidade de fonte XLSX em UTF-8 no transporte"
alwaysApply: false
---

# ADR-0918 — Identidade de fonte XLSX em UTF-8 no transporte

Data: 2026-10-30 · Status: preparação, não publicada.

Os headers HTTP não suportam diretamente toda a identificação Unicode da fonte. O cliente passa a transmitir `x-fonte-id-utf8` com UTF-8 codificado por `encodeURIComponent`; o servidor decodifica uma única vez e exige representação canônica, sem normalizar caracteres nem alterar acentos. O header legado `x-fonte-id` continua aceito para clientes anteriores, mas combinação dos dois é rejeitada. Caracteres de controle e sequências Unicode inválidas são recusados. A identificação decodificada continua sendo a mesma usada em locks, atestado e staging; hash de arquivo e IDs não mudam.

CORS deve permitir o header novo. Testar cliente, borda e origens reais antes do rollout coordenado; versões antigas não devem receber header novo de uma borda incompatível. Função, gates e homologação continuam fechados até revisão adversarial e testes integrados; nenhum dado legado será renomeado.
