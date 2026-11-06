---
name: "docs-adr-1274-conferir-projecao-no-banco-md"
description: "Documento Sinérgica SO: ADR-1274 — Conferência transacional da projeção de campo"
alwaysApply: false
---

# ADR-1274 — Conferência transacional da projeção de campo

Status: proposta local; não aplicada nem homologada.

Antes de persistir o processamento, uma guarda deve comparar a projeção normalizada com o envelope e com o mapeamento versionado e habilitado. A verificação é executada na mesma transação que cria ou vincula OS/Chamado; divergência reverte a transação. Inclui identidade, Cliente, título, descrição, estado, referências, técnico, horários e detalhes. Datas civis são confrontadas no fuso declarado, sem considerar sua simples igualdade como prova de contrato do fornecedor.

O processamento segue privado e desligado. A guarda não autentica o conteúdo do Auvo, não elimina necessidade de revisão do contrato nem prova ausência de efeitos de triggers ou dos consumidores legados. Validar integralmente ordenação de locks, formatos e fusos reais, referências e concorrência, permissões/RLS/FORCE, rollback e revisão adversarial antes de qualquer liberação.
