---
name: "docs-adr-0179-evidencia-declarada-retorno-md"
description: "Documento Sinérgica SO: ADR-0179 — Evidência estruturada declarada para retorno de campo"
alwaysApply: false
---

# ADR-0179 — Evidência estruturada declarada para retorno de campo

Status: proposta, não homologada.

Enquanto não houver contrato autenticado que comprove estrutura e origem dos dados remotos, operador autorizado registra evidências manuais tipadas e ligadas ao retorno S175/S168 já classificado. A entrada registra tipo, referência e descrição informados explicitamente, requestId, ator e revisão serializada do conjunto. É append-only e não interpreta texto, baixa arquivos, valida URLs, comprova a fonte nem altera cobertura ou estado de OS. Identidade e Cliente são conferidos no servidor. Consulta e comando permanecem revogados e os dois gates fechados.

Referências são texto, não links de acesso nem prova de existência; não colar credenciais ou dados sensíveis. Anexo/foto segura, validação de fonte Auvo, retenção e LGPD, atualização de cobertura, integridade histórica, interface e testes devem ser concluídos antes de qualquer uso operacional ou aprovação.
