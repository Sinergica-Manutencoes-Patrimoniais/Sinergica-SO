---
name: "docs-adr-1288-consulta-conflitos-origem-campo-md"
description: "Documento Sinérgica SO: ADR 1288 — Consulta de conflitos da origem de campo"
alwaysApply: false
---

# ADR 1288 — Consulta de conflitos da origem de campo

## Contexto

A visão do PCM informa apenas a contagem de conflitos da OS. Os recibos imutáveis já registram a entrega e a classificação, mas não há consulta restrita que permita identificar cada conflito.

## Decisão

Adicionar leitura paginada por Cliente e OS, limitada ao identificador do envelope, classificação e instante de registro. Reutilizar gate de estado de campo e capacidade `execucao.validar`. Não retornar payload, credenciais ou detalhes do contrato; não alterar nem reprocessar eventos.

## Implantação e retorno

Migration aditiva com flag de interface desligada; reverter desativando a flag. Não excluir recibos. Validar Cliente/OS, transferência, privacidade, revogação, paginação concorrente, acesso direto, RLS/FORCE e revisão adversarial antes de habilitar. Contagem e lista não significam resolução ou cobertura total da inbox.
