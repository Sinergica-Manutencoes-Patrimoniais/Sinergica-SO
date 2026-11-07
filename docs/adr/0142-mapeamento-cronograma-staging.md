---
name: "docs-adr-0142-mapeamento-cronograma-staging-md"
description: "Documento Sinérgica SO: ADR-0142 — Mapeamento explícito em staging de cronogramas"
alwaysApply: false
---

# ADR-0142 — Mapeamento explícito em staging de cronogramas

Status: proposta; não homologada.

## Contexto e decisão

E01-S169 usa o staging compartilhado de E01-S178. Cada escolha de alvo e recorrência fica em histórico imutável de uma linha do lote, com revisão otimista, autorização atual e idempotência. A disciplina é texto independente do alvo e a duração desconhecida permanece nula; a decisão de quatro semanas mensais precisa ser expressa pelo operador. O mapeamento não incorpora Plano, não aprova lote e não gera ocorrências, OS ou tarefas Auvo. Funções ficam revogadas e o gate de cronogramas fechado.

## Consequências

É necessário completar interface, classificação de todas linhas, aprovação de lote e incorporação transacional em rascunho, reconciliação de alterações e duplicidades, verificação de permissão e de concorrência, testes integrados e revisão adversarial antes de liberar. A fonte original e cada escolha anterior permanecem intactas. O gate não deve ser habilitado isoladamente.
