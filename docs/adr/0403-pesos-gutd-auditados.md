---
name: "docs-adr-0403-pesos-gutd-auditados-md"
description: "Documento Sinérgica SO: ADR-0403 — Pesos GUTD auditados e fator ausente"
alwaysApply: false
---

# ADR-0403 — Pesos GUTD auditados e fator ausente

O projeto já possui pesos globais `config.priorizacao_gutd` e exige soma 100, com alteração legada restrita a superadmin. Prepara-se comando privado de atualização explícita, com retrato anterior, justificativa, auditoria e idempotência; não cria pesos por Cliente nem altera configuração automaticamente.

Na composição, ausência de Dor do Cliente continua usando a regra existente de redistribuição apenas entre G/U/T informados. Se todos os pesos G/U/T forem zero, não há base para pontuar: retorna-se nulo, não zero. Gate e execução fechados; fluxo legado de configuração e migração de consumidores precisam revisão antes da ativação.
