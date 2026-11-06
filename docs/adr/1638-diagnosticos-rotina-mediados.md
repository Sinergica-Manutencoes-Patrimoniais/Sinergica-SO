---
name: "docs-adr-1638-diagnosticos-rotina-mediados-md"
description: "Documento Sinérgica SO: ADR-1638: diagnósticos de Rotina mediados"
alwaysApply: false
---

# ADR-1638: diagnósticos de Rotina mediados

## Contexto

As telas de suporte ao modo Visita e de exigência aprovada chamavam funções privadas e não conseguiam consultar seus resultados como usuário autenticado.

## Decisão

Usar mediadores autenticados que verificam ator, permissão `plano.gerir` e Cliente do Plano sob travas de autorização e de Plano. Os núcleos privados mantêm seus gates e validações de versão, Rotina e snapshot; suas ACLs não são ampliadas.

## Consequências

O resultado continua diagnóstico, sem certificar conformidade, validar fonte externa ou executar geração. A migração e as telas exigem validação antes de homologação.
