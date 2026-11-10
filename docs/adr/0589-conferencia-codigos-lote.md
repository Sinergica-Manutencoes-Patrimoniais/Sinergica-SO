---
name: "docs-adr-0589-conferencia-codigos-lote-md"
description: "Documento Sinérgica SO: ADR-0589 — Conferência de códigos na recepção"
alwaysApply: false
---

# ADR-0589 — Conferência de códigos na recepção

Status: proposta; gate fechado, não homologada.

Antes das decisões do lote, consulta paginada informa formato, diferença entre código informado e candidato, repetições entre linhas e contagens de correspondências e aliases somente do Cliente autorizado. Não expõe cadastros de outros Clientes, nem supõe que códigos legados sejam globalmente únicos. Correspondência pode ser atualização legítima, não rejeição automática.

Este diagnóstico não bloqueia nem autoriza aprovação ou incorporação e pode ficar desatualizado por concorrência. As validações transacionais existentes permanecem a autoridade na escrita. O guard legado 0332 aplica regra global a novas alterações; sua compatibilidade com o legado precisa revisão separada e não é alterada aqui. UI, testes e homologação pendentes; gate e RPC fechados.
