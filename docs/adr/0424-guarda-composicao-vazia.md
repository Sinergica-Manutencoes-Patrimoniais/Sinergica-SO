---
name: "docs-adr-0424-guarda-composicao-vazia-md"
description: "Documento Sinérgica SO: ADR-0424 — Guarda de composição vazia"
alwaysApply: false
---

# ADR-0424 — Guarda de composição vazia

Prepara-se proteção opcional nas inserções de vínculo de composição a Chamado e de Pendência a parcela: composição deve conter relação ativa e, na atribuição, a Pendência deve pertencer à composição do mesmo Cliente. A guarda bloqueia a linha da composição para serializar contra retirada de Pendência; não apaga vínculos existentes nem modifica Chamado.

Gate nasce desligado. Revisão de ordem de locks, concorrência e testes são obrigatórios antes de ativação; vínculo histórico existente em composição que se tornou vazia não é removido automaticamente.
