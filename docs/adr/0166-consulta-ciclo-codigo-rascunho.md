---
name: "docs-adr-0166-consulta-ciclo-codigo-rascunho-md"
description: "Documento Sinérgica SO: ADR-0166 — Consulta de ciclo explícito de rascunho"
alwaysApply: false
---

# ADR-0166 — Consulta de ciclo explícito de rascunho

## Contexto

O cadastro legado não tem estado de rascunho confiável e seus triggers de inserção enfileiram sincronização Auvo. Criar um ativo oficial com ciclo vazio e presumir que não foi usado abriria janela insegura.

## Decisão

Preparar consulta autorizada do ciclo explícito já existente, retornando código atual, revisão e marcos, sem classificar como rascunho qualquer registro sem ciclo. A interface pode oferecer a edição de 0363 somente para ciclo sem marcos; comando e consulta seguem revogados e a flag desligada.

## Limites

Não é uma trilha de criação completa. A criação transacional de rascunho exige estado oficial que impeça publicação, sincronização e referência por escritores antigos, além de todos os marcos de aprovação/etiqueta/sync/OS. Não usar supressão Auvo como prova de rascunho. O comando e o gate de 0363 continuam desabilitados até essas garantias e revisão concorrente. Sem aplicação ou testes.
