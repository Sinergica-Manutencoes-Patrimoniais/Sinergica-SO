---
name: "docs-adr-1641-proposta-encerramento-mediada-md"
description: "Documento Sinérgica SO: ADR-1641: proposta mediada de encerramento preventivo"
alwaysApply: false
---

# ADR-1641: proposta mediada de encerramento preventivo

## Contexto

A interface de proposta chamava um núcleo privado; usuários autenticados não conseguiam registrar a proposta pela tela.

## Decisão

Mediar a proposta com ator, Cliente, Plano, permissão existente `execucao.validar` e travas de autorização e Plano da 1782. Validar a ocorrência no Plano e preservar gate, comparação de OS e declaração, histórico e replay do núcleo privado. A guarda explícita de declaração obsoleta passa a `P0010`; falhas reais de serialização continuam `40001`.

## Consequências

A proposta não encerra ocorrência ou OS nem comprova integralidade do escopo. A migração e a interface dependem de validação antes da homologação.
