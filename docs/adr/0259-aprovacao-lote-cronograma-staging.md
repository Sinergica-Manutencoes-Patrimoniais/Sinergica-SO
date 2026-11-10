---
name: "docs-adr-0259-aprovacao-lote-cronograma-staging-md"
description: "Documento Sinérgica SO: ADR-0259 — Aprovação isolada de lote em staging"
alwaysApply: false
---

# ADR-0259 — Aprovação isolada de lote em staging

Status: proposta, não homologada.

A aprovação proposta registra somente uma revisão imutável de um lote; não cria ou altera Plano, Rotina, ocorrência ou tarefa. Exige simultaneamente `plano.gerir` e `cadastro.aprovar` no Cliente, revisão otimista, conferência concluída e atual de todas as linhas, identidade e mapeamento para dados não rejeitados, nenhum dado ainda marcado em revisão, pelo menos um dado elegível e alvo atual ativo do mesmo Cliente. Rejeições e linhas ignoradas permanecem evidenciadas e não são dados elegíveis. O lote é bloqueado durante as verificações, assim como os alvos aceitos; idempotência e auditoria compartilham a transação.

Este registro não é aprovação do Plano nem implementação de qualquer regra de autoaprovação do Plano. Revisão posterior do lote não é aprovada automaticamente. Gate próprio nasce fechado, o gate do staging também se aplica e EXECUTE fica revogado; ativação exige validação das permissões, política operacional, concorrência, RLS e contrato de futura incorporação. Conclusão da conferência é declaração humana, não prova normativa. Rollback operacional mantém gates fechados e preserva o histórico.
