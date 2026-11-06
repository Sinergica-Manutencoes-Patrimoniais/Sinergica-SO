---
name: "docs-adr-0057-regra-cliente-contexto-md"
description: "Documento Sinérgica SO: ADR-0057 — Cliente esperado na criação de regra"
alwaysApply: false
---

# ADR-0057 — Cliente esperado na criação de regra

**Status:** decisão para implementação local E01-S166. **Data:** 2026-10-27.

O comando usado pela interface informa o Cliente de contexto como verificação, não como fonte de autoridade. O servidor bloqueia o contrato, verifica que pertence a esse Cliente e que a sessão tem concessão atual antes de delegar à criação idempotente existente. Divergência e ausência retornam o mesmo erro de acesso; retry também exige autorização. Isso impede que uma troca de contexto ou pedido recuperado associe regra ao Cliente errado, inclusive quando o usuário tem acesso a vários Clientes. O comando anterior permanece para compatibilidade e continua autorizado pelo Cliente real do contrato.
