---
name: "docs-adr-1465-publicacao-materiais-mediada-md"
description: "Documento Sinérgica SO: ADR-1465 — Publicação de materiais mediada"
alwaysApply: false
---

# ADR-1465 — Publicação de materiais mediada

Prepara entrada autenticada para publicar a versão pública de uma lista da OS e do Cliente informados. O comando existente mantém revisão, validação das linhas, idempotência e auditoria; a entrada confirma ator, vínculo, autorização e gate antes e depois da chamada. O gate nasce fechado e a interface exige flag própria.

A entrada obtém a trava do pedido antes das linhas, acompanhando a ordem do núcleo também em reenvios. A migration e a interface não foram testadas nem aplicadas. Validar concorrência de revogação e transferência, ordem de todas as travas, permissões/RLS, replay, rollback, privacidade dos campos públicos e rollout coordenado antes de ativar. A publicação não informa disponibilidade nem cria OS ou cobrança.
