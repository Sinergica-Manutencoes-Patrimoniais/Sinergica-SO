---
name: "docs-adr-1250-historico-codigo-grupo-md"
description: "Documento Sinérgica SO: ADR-1250 — Histórico autorizado de códigos de Grupo"
alwaysApply: false
---

# ADR-1250 — Histórico autorizado de códigos de Grupo

**Status:** proposta local, não homologada. Complementa ADR-1246.

Preparar consulta paginada dos códigos registrados de um Grupo no Cliente autorizado, com estado atual ou histórico, responsável e data do registro. Motivo de substituição permanece no evento de auditoria; esta consulta não o expõe nem presume que a etiqueta física foi atualizada. Um gate próprio nasce fechado.

Antes de liberar, validar revogação e Cliente concorrentes, paginação consistente, privacidade, ACL/RLS, cobertura dos eventos e revisão adversarial. A consulta não integra staging nem cria código.
