---
name: "docs-adr-1459-fotos-retorno-mediadas-md"
description: "Documento Sinérgica SO: ADR 1459 — Referências de fotos mediadas"
alwaysApply: false
---

# ADR 1459 — Referências de fotos mediadas

Listagem e referência de fotos privadas, bem como sua associação a respostas, usam entradas autenticadas que conferem Cliente, retorno e autorização atual. Os núcleos privados e as verificações de objeto e revisão continuam responsáveis pela operação. O acesso à referência não comprova autenticidade nem autoriza acesso direto ao arquivo.

Validar ACL, sessão, paginação, concorrência, Storage, replay e revisão adversarial antes de habilitar.
