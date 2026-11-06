---
name: "docs-adr-0195-seletor-triagem-origem-md"
description: "Documento Sinérgica SO: ADR-0195 — Seleção mínima de Cliente para triagem"
alwaysApply: false
---

# ADR-0195 — Seleção mínima de Cliente para triagem

## Decisão

Preparar consulta paginada que retorna apenas ID e nome de Clientes ativos para triagem, exigindo concessão global e capacidade atual de reconciliação para cada Cliente. A tela global é montada no Dashboard PCM sob flag desligada. Não retornar CNPJ, contatos ou payload do envelope.

## Limites

Consulta revogada; exige validação de autorização, paginação e concorrência antes de ativação. A indicação continua declaração humana, sem criar ou aplicar objetos operacionais.
