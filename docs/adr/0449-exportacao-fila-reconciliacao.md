---
name: "docs-adr-0449-exportacao-fila-reconciliacao-md"
description: "Documento Sinérgica SO: ADR-0449 — exportação local limitada da fila"
alwaysApply: false
---

# ADR-0449 — exportação local limitada da fila

Status: proposto; não homologado. A exportação consulta novamente no servidor a primeira página (até 100 itens) do filtro selecionado, preservando a autorização e escopo da RPC 0672. Não é exportação integral nem snapshot histórico: dados podem mudar durante a consulta. O CSV contém apenas campos operacionais mínimos, com proteção contra fórmulas em todas as células, e é criado no navegador sem upload ou arquivo remoto. Não inclui payload, mensagens de erro ou credenciais. Flag permanece desligada; revisão de acesso, escaping e navegadores ainda exige testes.

A migration 0675 prepara resumo de até 1.000 itens do mesmo escopo por estado persistido, indicando quando a amostra foi truncada. Não representa total da fila quando truncada, nem prova sucesso remoto. A eficiência da consulta, autorização e semântica de amostragem exigem testes antes de qualquer grant.
