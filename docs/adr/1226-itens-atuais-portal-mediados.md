---
name: "docs-adr-1226-itens-atuais-portal-mediados-md"
description: "Documento Sinérgica SO: ADR-1226 — Itens públicos atuais mediados"
alwaysApply: false
---

# ADR-1226 — Itens públicos atuais mediados

## Decisão

Preparar consulta autenticada dos itens públicos da versão atual da proposta operacional, reutilizando a mediação e projeção de itens históricos do ADR-1222. A função exige que a versão continue sendo a atual e que exista snapshot estruturado; versões ausentes não são convertidas em lista vazia válida.

A resposta contém somente ID, descrição, quantidade e preço público unitário. Não publica, aprova ou altera a proposta e não prova ausência de dados sensíveis inseridos em texto livre.

## Gates

Manter flag e gates fechados até testes de versão concorrente, retirada, projeção, privacidade, RLS/FORCE, autorização/revogação e revisão adversarial. A consulta de itens é separada do restante da proposta.
