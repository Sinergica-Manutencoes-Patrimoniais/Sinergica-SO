---
name: "docs-adr-1220-historico-materiais-portal-mediado-md"
description: "Documento Sinérgica SO: ADR-1220 — Histórico público de materiais mediado"
alwaysApply: false
---

# ADR-1220 — Histórico público de materiais mediado

## Decisão

Preparar entradas autenticadas para descobrir listas, consultar versões e ler a versão pública de materiais por Cliente e OS. As funções internas existentes permanecem privadas; a mediação exige ator atual, vínculo ativo de síndico com Cliente, OS correspondente e gate de visibilidade. A versão só é devolvida pelo núcleo quando publicada e não retirada.

As entradas não exibem custos internos, não modificam disponibilidade e não criam OS. A paginação não é fotografia transacional e a proteção contra retirada concorrente depende dos escritores de visibilidade.

## Gates

Manter flag e gate fechados até ensaios de RLS/FORCE, revogação de contato, retirada simultânea, vínculo entre Clientes, locks, privacidade e revisão adversarial. Não presumir que a trava de autorização abrange todos os escritores.
