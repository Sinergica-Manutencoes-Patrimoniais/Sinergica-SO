---
name: "docs-adr-0253-classificacao-conferencia-cronograma-md"
description: "Documento Sinérgica SO: ADR-0253 — Classificação e conclusão da conferência por linha"
alwaysApply: false
---

# ADR-0253 — Classificação e conclusão da conferência por linha

Status: proposta, não homologada.

O PCM classifica explicitamente cada linha imutável da matriz como cabeçalho, dado ou ignorada e declara sua conferência pendente ou concluída, justificando a escolha. Essa declaração é revisionada, auditada e pode ser substituída por nova declaração sem modificar a fonte. Conclusão da conferência não é aprovação do lote, validação normativa, incorporação nem garantia de segurança da geração operacional. Não se presume automaticamente o papel de nenhuma posição. Gate e EXECUTE permanecem fechados até revisão e testes; o rollback operacional mantém o gate fechado e preserva o histórico.
