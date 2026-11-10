---
name: "docs-adr-0874-s179-criacao-lista-mediada-md"
description: "Documento Sinérgica SO: ADR 0874 — Mediação da criação de lista de materiais"
alwaysApply: false
---

# ADR 0874 — Mediação da criação de lista de materiais

## Contexto

A criação existente em 0322 valida OS, Cliente, concessão, requestId e auditoria, mas é exposta diretamente ao usuário autenticado sem o protocolo atual de serialização da autorização. Uma revogação concorrente pode ocorrer após sua checagem. O adapter web é o consumidor identificado no repositório; clientes externos ou versões antigas ainda exigem inventário.

## Decisão

Preparar função mediadora de criação, com gate próprio fechado por padrão, sessão autenticada, READ COMMITTED, trava compartilhada do protocolo de autorização e releitura do gate sob lock. Chamar o núcleo existente dentro da transação para manter validação, revisão, idempotência, OS e auditoria. Revogar acesso direto ao núcleo na mesma migration e trocar o adapter para a mediadora, sem fallback.

## Implantação e limites

A revogação quebra clientes antigos que ainda chamem o núcleo; não aplicar em produção nem abrir o gate sem inventário de consumidores, rollout coordenado de banco e clientes, plano de reversão e revisão adversarial. Em reversão, fechar gate e restaurar acesso somente após análise de segurança; não apagar dados ou auditoria. A decisão não protege leitura individual, edição, disponibilidade ou outras RPCs de materiais, que precisam de tratamento próprio. Sem Auvo.
