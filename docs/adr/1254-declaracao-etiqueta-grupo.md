---
name: "docs-adr-1254-declaracao-etiqueta-grupo-md"
description: "Documento Sinérgica SO: ADR-1254 — Declaração de etiqueta de Grupo"
alwaysApply: false
---

# ADR-1254 — Declaração de etiqueta de Grupo

**Status:** proposta local, não homologada.

Preparar declaração auditada de etiqueta aplicada ao Grupo, admitindo código atual ou histórico do mesmo Grupo e Cliente. A declaração não imprime nem comprova aplicação física. Cada pedido é idempotente; código antigo continua resolvendo o mesmo Grupo. Gate nasce fechado, sem envio a Auvo.

Antes de liberar, validar autorização e revogação concorrentes, repetição, Cliente, concorrência com substituição, histórico de códigos, ACL/RLS, privacidade e revisão adversarial. A funcionalidade não substitui geração de etiqueta ou confirmação física.
