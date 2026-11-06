---
name: "docs-adr-0564-conferencia-complemento-md"
description: "Documento Sinérgica SO: ADR-0564 — conferência de complemento"
alwaysApply: false
---

# ADR-0564 — conferência de complemento

Status: proposto; gates fechados, não aplicado nem homologado. A conferência de complemento valida Cliente, vínculo de item base não cancelado e já conferido/parcial/faturado, origem e competência coincidentes, identidade e valor registrados no comando de criação, além de competência aberta. Retentativa concluída é delegada ao comando proprietário. O wrapper é restritivo e pode rejeitar complementos sobre base ainda pendente; não representa aprovação de negócio adicional.

A verificação do vínculo não revalida novamente todas as fontes operacionais originais; alterações posteriores dessas fontes e concorrência com correções exigem adaptação coordenada, testes e revisão antes de ativar. Nenhuma cobrança ou efeito externo é realizado.
