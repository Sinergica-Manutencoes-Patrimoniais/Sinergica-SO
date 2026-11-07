---
name: "docs-adr-1464-conferencia-candidato-servico-md"
description: "Documento Sinérgica SO: ADR 1464 — Conferência do candidato de serviço"
alwaysApply: false
---

# ADR 1464 — Conferência do candidato de serviço

A conferência financeira de serviço reconfere a origem e a atestação antes de usar o comando financeiro existente. Uma autorização privada e transacional limita a mudança ao item, revisão, ator e valor informados; comandos repetidos usam recibo próprio. O gate inicia fechado e a operação não emite cobrança.

Validar a exclusividade de todas as origens, contratos, autorização, competência, concorrência, replay, locks, valores, revisão adversarial e integração de faturamento antes de habilitar.
