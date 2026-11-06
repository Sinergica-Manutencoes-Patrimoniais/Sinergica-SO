---
name: "docs-adr-0691-mediacao-retratos-incorporacao-md"
description: "Documento Sinérgica SO: ADR-0691 — Mediação de retratos de incorporação"
alwaysApply: false
---

# ADR-0691 — Mediação de retratos de incorporação

As consultas de campos de staging e retratos oficiais de Sistema, Componente e Localização recebem mediadores para usuários autenticados. O gate da ADR-0687 permanece desligado por padrão; o Cliente é autorizado com `cadastro.aprovar` e os núcleos preservam as validações de pertencimento da entidade e linha. As funções internas continuam sem concessão direta.

Ativação requer revisão de segurança e privilégios, testes de isolamento entre Clientes e validação do schema exposto. O retrato não representa aprovação nem executa alteração.
