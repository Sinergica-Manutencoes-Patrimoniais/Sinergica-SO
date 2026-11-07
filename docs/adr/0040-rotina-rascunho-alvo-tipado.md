---
name: "docs-adr-0040-rotina-rascunho-alvo-tipado-md"
description: "Documento Sinérgica SO: ADR-0040 — Rotinas de rascunho e alvos tipados"
alwaysApply: false
---

# ADR-0040 — Rotinas de rascunho e alvos tipados

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

Uma versão inicial de rascunho é criada ao adicionar a primeira Rotina. Cada Rotina possui identidade própria, uma referência tipada exclusiva a Sistema, Componente (`pcm.equipamentos`) ou Grupo Quantitativo, e referencia simultaneamente Plano e versão do mesmo Plano por chave composta. Várias Rotinas podem apontar ao mesmo alvo com regras próprias. A inclusão transacional exige `plano.gerir`, revisão do Plano e `requestId`; valida o Cliente do alvo no servidor, registra auditoria e não gera execução.

Referências de alvo são bloqueadas durante a gravação e mudanças posteriores de Cliente que deixariam uma Rotina inconsistente são rejeitadas. Rascunho pode conter tempo zero/ausente e data-base ausente; não é aprovação. Tolerâncias inicializam em zero. Fluxo de edição, questionário, aprovação, vigências e novas versões ainda não estão implementados. Antes de PASS: validar inventário legado, concorrência, desativação/exclusão e semântica de versões em uso; nenhuma rotina legada é convertida automaticamente.
