---
name: "docs-adr-0235-consulta-vinculo-rotina-serie-md"
description: "Documento Sinérgica SO: ADR-0235 — Consulta de vínculo explícito de Rotina por Visita"
alwaysApply: false
---

# ADR-0235 — Consulta de vínculo explícito de Rotina por Visita

Status: proposta, não homologada.

Consulta paginada lista vínculos Rotina lógica–série apenas para Plano autorizado do Cliente e usuário com `plano.gerir` e `visita.confirmar`. Não gera ocorrências, não prova cobertura de feriados nem conflita/resolve PMOC. Gate da materialização permanece fechado e função revogada. Antes de ativação faltam gestão de vigência do vínculo, desvinculação auditada, concorrência, testes e revisão adversarial.
