# ADR-1554 — Listagem de retorno pela fotografia da OS

Status: proposto; aguarda testes. A listagem de envelopes usa a fotografia imutável quando existir e preserva o caminho legado apenas em sua ausência. Os dados de Cliente e identidade da preparada são conferidos; origens ambíguas não são listadas. Mantém autorização, paginação, guardas e regra 1045; não habilita execução nem aciona Auvo. Uma fotografia inconsistente não deve produzir fallback para fonte legada.
