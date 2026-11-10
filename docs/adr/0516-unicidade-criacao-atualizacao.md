---
name: "docs-adr-0516-unicidade-criacao-atualizacao-md"
description: "Documento Sinérgica SO: ADR-0516 — Unicidade de criação e atualizações por lote"
alwaysApply: false
---

# ADR-0516 — Unicidade de criação e atualizações por lote

Mesma entidade pode ser atualizada ou vinculada em lotes posteriores, sem perder o registro original. Mantém-se unicidade por entidade dentro de cada lote e unicidade global da criação por tipo/entidade, em registro privado verificado ao fim da transação. Com gate desligado, comportamento anterior bloqueia repetição global. Histórico anterior sem comando classificável é tratado conservadoramente como criação. Comandos novos precisam registrar resultado `created` booleano na mesma transação; falhas revertem tudo. Revisão adversarial de migração, concorrência e consumidores, testes e backup antes da aplicação.
