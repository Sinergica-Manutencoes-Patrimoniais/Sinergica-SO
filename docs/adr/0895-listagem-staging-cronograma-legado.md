---
name: "docs-adr-0895-listagem-staging-cronograma-legado-md"
description: "Documento Sinérgica SO: ADR-0895 — Listagem controlada de lotes legados"
alwaysApply: false
---

# ADR-0895 — Listagem controlada de lotes legados

Data: 2026-10-30 · Status: preparação; gates fechados, não homologado.

## Decisão

Preparar leitura paginada de metadados dos lotes legados por Cliente: ID, fonte, revisão, data e indicador de reconciliação. Não retornar matriz, anotações, comandos ou dados de atores. O indicador não certifica consistência nem autoriza transporte; o comando continua validando tudo na transação própria.

A leitura exige sessão, `plano.gerir` e `cadastro.aprovar`, usa trava de autorização e gate exclusivo, desligado por padrão. O gate da listagem é independente do gate de transporte: habilitar consulta não autoriza migração. Paginação por ID limita cada página a 100; não promete fotografia estável entre páginas.

## Implantação e retorno

Sem alterações nos lotes e sem acesso direto às tabelas. A consulta não é conectada à interface até testes de isolamento, concessão/revogação, revisão adversarial e rollout coordenado. Desligar o gate bloqueia novas leituras, preservando os registros.
