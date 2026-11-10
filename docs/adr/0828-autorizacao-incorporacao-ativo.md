---
name: "docs-adr-0828-autorizacao-incorporacao-ativo-md"
description: "Documento Sinérgica SO: ADR 0828 — Serializar autorização na incorporação de ativo"
alwaysApply: false
---

# ADR 0828 — Serializar autorização na incorporação de ativo

A mediação de incorporação 0919 chama o núcleo 0397, que verifica `cadastro.aprovar` após travas, mas uma revogação posterior a essa verificação poderia ocorrer antes do commit. Reusar a trava compartilhada transacional do protocolo 0319/0976, em READ COMMITTED, antes de consultar autorização e adquirir as travas do núcleo. O lado exclusivo dos triggers 0319 coordena alterações nas fontes atuais de permissão.

A alteração cobre apenas `sso_incorporar_ativo_autorizado`; não protege outros mediadores nem prova sua integração. Conserva assinatura, ACL, gates, idempotência, aprovação, códigos e registros existentes. Conflito de autorização retorna `55P03` para repetição. O gate da mediação é bloqueado para escrita durante a operação. Não aciona Auvo.

Reversão: restaurar 0919; sem apagar dados. Habilitação exige testes das duas ordens, integração e revisão adversarial, bem como verificação contínua das fontes e triggers de autorização. Trava global pode causar contenção; revogação externa de JWT não é serializada.
