---
name: "docs-adr-0482-edicao-rotina-em-revisao-md"
description: "Documento Sinérgica SO: ADR-0482 — Edição de Rotina em revisão"
alwaysApply: false
---

# ADR-0482 — Edição de Rotina em revisão

Status: preparado, gate desligado, não aplicado nem homologado. Recria a função interna canônica 0263 preservando validação, autorização, revisão, idempotência e auditoria; a única alteração permite Plano em revisão quando o gate está ativo. A própria função continua exigindo Rotina de versão rascunho e alvo do Cliente, preservando a versão aprovada. O comportamento anterior permanece com gate desligado.

Não aprova versão nem altera ocorrências ou OS. Escritores legados, gatilhos, contratos de questionário e exigência normativa devem ser reconferidos após mudanças. Requer teste de concorrência, comparação da função substituída com versão efetivamente aplicada, revisão adversarial e política de ativação.
