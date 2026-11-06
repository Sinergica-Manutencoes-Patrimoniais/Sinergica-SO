---
name: "docs-adr-1500-mediacao-ponte-legada-md"
description: "Documento Sinérgica SO: ADR-1500 — Mediação da ponte legada"
alwaysApply: false
---

# ADR-1500 — Mediação da ponte legada

As telas de relação e materialização de ciclos legados chamavam funções privadas sem concessão a `authenticated`, impedindo sua execução. A integração precisa permanecer isolada por Cliente e respeitar os controles existentes.

Criar RPCs mediadas com gate próprio desligado, validação de identidade e concessão `plano.gerir` antes e depois da operação, além de trava de autorização. Escritas exigem protocolo de concorrência de impactos e delegam aos núcleos existentes, que mantêm validação de relação, alvo, vigência, replay e ausência de OS/Auvo. As funções internas permanecem privadas. As interfaces usam as RPCs mediadas e conferem a sessão.

Testar autenticação, revogação, isolamento de Cliente, replay, lote e conflitos antes de habilitar. A mediação não prova equivalência global nem libera aprovação ou deploy.
