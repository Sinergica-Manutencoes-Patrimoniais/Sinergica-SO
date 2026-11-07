---
name: "docs-adr-1642-inventario-geracao-legada-mediado-md"
description: "Documento Sinérgica SO: ADR-1642: inventário de geração legada mediado"
alwaysApply: false
---

# ADR-1642: inventário de geração legada mediado

## Contexto

A tela de transição chamava diretamente o inventário agregado privado, sem acesso para usuário autenticado.

## Decisão

Mediar a consulta com ator autenticado, Cliente e permissão existente `plano.gerir`, sob trava de autorização. O núcleo privado mantém seu gate e sua ACL; não se inferem equivalências entre Planos.

## Consequências

O inventário permanece agregado por Cliente e não comprova ausência de fontes externas ou interrupção do gerador. A migração e a interface exigem validação antes de homologação.
