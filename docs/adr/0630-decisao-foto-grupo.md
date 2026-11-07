---
name: "docs-adr-0630-decisao-foto-grupo-md"
description: "Documento Sinérgica SO: ADR-0630 — Decisão PCM sobre foto de Grupo"
alwaysApply: false
---

# ADR-0630 — Decisão PCM sobre foto de Grupo

PCM registra aceitação ou rejeição de foto associada ao atestado, com revisão por ocorrência, motivo e histórico imutável. O objeto privado, nota, OS, vínculo e Cliente são revalidados; a decisão não comprova autoria, conteúdo ou execução e não encerra ocorrência. Gates e permissões permanecem fechados.

Objeto pode desaparecer posteriormente e uma decisão anterior pode ficar obsoleta; qualquer consumidor futuro deve revalidar identidade e última decisão. Concorrência, segurança, testes e homologação continuam pendentes.
