---
name: "docs-adr-0476-reclassificacao-resposta-proposta-md"
description: "Documento Sinérgica SO: ADR-0476 — Propostas versionadas de reclassificação"
alwaysApply: false
---

# ADR-0476 — Propostas versionadas de reclassificação

Registrar propostas de reclassificação por resposta, preservando resultado e justificativa originais, motivo, ator, revisões e histórico. Se retorno já foi aprovado, exigir última decisão versionada explícita de reabertura; histórico de validação não reconciliado bloqueia. A proposta não substitui resposta efetiva nem alimenta geração de Pendências ou validação: os consumidores atuais leem diretamente a resposta original e precisam de integração transacional antes da efetivação. Nenhuma aprovação é concedida aqui. Gate desligado; revisão, testes e exposição pendentes.
