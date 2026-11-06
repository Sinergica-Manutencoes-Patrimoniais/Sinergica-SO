---
name: "docs-adr-1336-preservacao-historico-codigo-grupo-md"
description: "Documento Sinérgica SO: ADR-1336 — Preservação do histórico de código de Grupo"
alwaysApply: false
---

# ADR-1336 — Preservação do histórico de código de Grupo

**Estado:** proposta; não aplicada nem homologada.

## Contexto

Uma correção de código de Grupo mantém o registro anterior como código histórico. O cadastro de identidade é privado, mas a preservação não deve depender apenas de ausência de comandos comuns de exclusão ou edição.

## Decisão

Preparar guarda no banco que recusa exclusão e esvaziamento da tabela e qualquer edição dos dados de um código já registrado, exceto a transição de `atual = true` para `atual = false` usada pela substituição auditada. Uma verificação diferida exige recibo e evento correspondentes na mesma transação. Códigos históricos não podem voltar a atuais por edição direta; nova correção usa novo registro. A guarda não concede acesso adicional nem define política de retenção para dados pessoais.

## Limites

Não impede administrador de remover ou desabilitar a própria guarda ou inserir evidência falsa. Antes de implantar, inventariar manutenção, restauração, exclusão de Cliente e rotinas privilegiadas; ensaiar substituição, validação diferida e rollback, migrações, concorrência e políticas de retenção, com revisão adversarial. Código anterior e nova guarda não foram testados nesta etapa.
