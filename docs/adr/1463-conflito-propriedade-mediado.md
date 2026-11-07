---
name: "docs-adr-1463-conflito-propriedade-mediado-md"
description: "Documento Sinérgica SO: ADR 1463 — Conflito de propriedade mediado"
alwaysApply: false
---

# ADR 1463 — Conflito de propriedade mediado

Consulta de conflitos e início da observação para o Cliente atual usam entradas autenticadas, mantendo privados os núcleos existentes. A operação exige autorização para os dois Clientes e preserva a titularidade do histórico anterior. Não transfere a OS nem comprova estado remoto.

Gates continuam fechados. Validar ACL, privacidade, concorrência, revogação, replay e revisão adversarial antes de habilitar.
