# ADR-0650 — Revisão independente de retificação

Revisão PCM imutável e auditada, por pessoa diferente da solicitante, com decisão e motivo. Mantém a classificação original e o snapshot; não efetiva automaticamente a alteração nem autoriza faturamento. A revisão também bloqueia se existir qualquer item faturável do Cliente, por falta de identificação transversal completa; isso pode bloquear casos legítimos. Lock compartilhado serializa inserção de itens durante a revisão, não impede itens posteriores. Gate fechado; revisar locks, transações, escopo financeiro e testar antes de ativar.
