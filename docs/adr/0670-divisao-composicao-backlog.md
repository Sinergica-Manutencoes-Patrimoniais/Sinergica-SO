---
name: "docs-adr-0670-divisao-composicao-backlog-md"
description: "Documento Sinérgica SO: ADR-0670 — Divisão auditada de composição de Backlog"
alwaysApply: false
---

# ADR-0670 — Divisão auditada de composição de Backlog

Uma seleção humana própria e não vazia é transferida atomicamente para nova composição, mantendo ao menos uma Pendência na original. Os IDs das Pendências e suas revisões de origem são preservados; a composição original recebe nova revisão e a nova começa em revisão 1. O evento de transferência e os comandos são imutáveis e idempotentes. Nenhum Chamado ou OS é criado.

Divisão de composição já vinculada a Chamado ou parcela é recusada. A nova composição não herda fatores GUTD e os fatores da composição original são limpos após a divisão, com valores anteriores registrados na auditoria: não se presume que a classificação anterior se aplique a qualquer subconjunto. Ambas exigem nova avaliação. O gate fica desligado e não são concedidas permissões. Escritores legados, regras de histórico, locks, testes e revisão adversarial devem ser examinados antes de ativação.
