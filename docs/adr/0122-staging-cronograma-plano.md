---
name: "docs-adr-0122-staging-cronograma-plano-md"
description: "Documento Sinérgica SO: ADR-0122 — Staging de matrizes de cronograma"
alwaysApply: false
---

# ADR-0122 — Staging de matrizes de cronograma

## Estado

Proposta não homologada. Migration 0347 não aplicada; interface desligada por padrão.

## Decisão

Receber matriz tipada de valores de cronograma em staging próprio por Cliente, sem gravar Planos ou Rotinas oficiais. O lote conserva matriz original, identificador de fonte informado, revisão e autoria; cada anotação de revisão é append-only e auditada. Escritas exigem `plano.gerir`, requestId e revisão; repetição idêntica retorna resultado anterior, alterações concorrentes conflitam.

## Limites e gates

A matriz em JSON não substitui importação XLSX, vínculo de arquivo/hash ou leitura segura de arquivos compactados. Recepção de matriz não prova estrutura da fonte nem aprova itens; conferir cabeçalhos e mapeamentos de alvos/recorrência com os validadores existentes, implementar parser seguro e aprovação server-side com autorização, unicidade, preservação de origem e atomicidade antes de incorporar quaisquer dados. Anotações não significam aprovação. Sem tabelas oficiais, integração Auvo, deploy ou testes reais nesta etapa. Antes de ativar validar tamanho, RLS, concorrência, revogação, histórico e proteção dos dados de campo.
