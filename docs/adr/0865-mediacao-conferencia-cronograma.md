---
name: "docs-adr-0865-mediacao-conferencia-cronograma-md"
description: "Documento Sinérgica SO: ADR-0865 — Conferência e decisão de cronograma no staging canônico"
alwaysApply: false
---

# ADR-0865 — Conferência e decisão de cronograma no staging canônico

Status: preparado; gates permanecem fechados e homologação pendente.

As operações de conferência, identificação e revisão são expostas por mediação sobre o lote S178, reutilizando o gate e a trava de autorização da ADR-0860. A aprovação do lote exige adicionalmente `cadastro.aprovar`, validada pelo núcleo privado, e gate próprio preexistente; não aprova o Plano nem cria OS. O núcleo permanece privado. As consultas de conferência têm correção pontual de referência ambígua ao gate, sob verificação de definição.

A incorporação em Plano é operação distinta, sujeita a aprovação atual, revisão e gate próprios. A mediação verifica `plano.gerir` com a mesma trava de autorização; o núcleo privado mantém validação de Cliente e estado. Todas as mudanças ficam preparadas, sem ativar gates ou integrações.
