---
name: "docs-adr-0709-preservar-atributos-grupo-incorporado-md"
description: "Documento Sinérgica SO: ADR-0709 — Preservação de atributos de Grupo incorporado"
alwaysApply: false
---

# ADR-0709 — Preservação de atributos de Grupo incorporado

Uma guarda aditiva, desligada por padrão, impede novos fatos de incorporação de Grupo enquanto a conferência de atributos não estiver habilitada. Quando habilitada, rejeita atributos de staging informados que a incorporação atual não transporta nem valida: somente nome, referência de pai, quantidade e código informado seguem para as validações já existentes. Não descarta o staging nem altera regras de código, quantidade ou vínculo.

O fato é inserido na mesma transação da alteração oficial: erro reverte a operação. Repetições idempotentes anteriores não inserem outro fato, sujeitas a autorização e demais gates. A ativação exige revisão e testes de preservação, concorrência e recuperação.
