---
name: "docs-adr-0876-s179-eventos-materiais-mediados-md"
description: "Documento Sinérgica SO: ADR 0876 — Mediação de disponibilidade e exceções de materiais"
alwaysApply: false
---

# ADR 0876 — Mediação de disponibilidade e exceções de materiais

## Contexto

O comando de 0328 registra informação de disponibilidade ou exceção, com revisão, idempotência e auditoria, mas está acessível sem serialização da autorização com revogação concorrente.

## Decisão

Preparar mediadora autenticada com gate próprio fechado, READ COMMITTED, trava compartilhada de autorização e releitura do gate. Delegar validação, vínculo, evento e auditoria ao núcleo existente na mesma transação; torná-lo privado e conectar o adapter sem fallback. Disponibilidade segue informativa; exceção não implica confirmação física nem alteração automática de OS ou Auvo.

## Limites

Não implantar sem inventário de clientes antigos, rollout coordenado, testes de concorrência e revisão adversarial. Outras leituras e comandos de materiais não são protegidos por esta decisão. Reversão operacional começa fechando o gate e requer análise antes de restaurar ACL antiga; histórico permanece preservado.
