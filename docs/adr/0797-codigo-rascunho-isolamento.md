---
name: "docs-adr-0797-codigo-rascunho-isolamento-md"
description: "Documento Sinérgica SO: ADR 0797 — Isolamento da edição de código de rascunho"
alwaysApply: false
---

# ADR 0797 — Isolamento da edição de código de rascunho

A verificação de OS do núcleo 0363 usa a visão transacional. Em teste sintético de duas sessões com gate de marcos desligado, uma transação REPEATABLE READ iniciada antes de uma OS confirmada não enxergou a referência e aceitou editar o código. A chamada testada era privada e foi revertida; não foi demonstrado acesso público ao núcleo.

O wrapper 0876 passa a exigir READ COMMITTED antes de invocar o núcleo, mantendo gates desligados e ACL revogada. Nenhum código legado ou alias é modificado. Isso reduz a exposição a snapshots antigos na fronteira preparada, mas não prova o protocolo inteiro: escritores de uso, ordenação de locks, concorrência sob READ COMMITTED, marcos e autorização atual ainda exigem testes integrados. Não habilitar a funcionalidade antes dessas provas e da revisão adversarial.

Rollback: restaurar a definição 0876 sem conceder acesso; manter gate desligado.
