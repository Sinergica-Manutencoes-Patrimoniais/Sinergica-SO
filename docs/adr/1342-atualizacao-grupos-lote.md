---
name: "docs-adr-1342-atualizacao-grupos-lote-md"
description: "Documento Sinérgica SO: ADR-1342 — Atualização selecionada de Grupos em lote"
alwaysApply: false
---

# ADR-1342 — Atualização selecionada de Grupos em lote

**Estado:** proposta; não aplicada nem homologada.

## Contexto

O levantamento permite atualizar individualmente Grupo existente com revisão, motivo e auditoria. A importação precisa também permitir atualização em massa após conferência do PCM, sem sobrescrever códigos nem criar cadastros automaticamente.

## Decisão

Preparar comando transacional para até 50 linhas escolhidas explicitamente. Cada item conserva identificador de pedido próprio, Grupo e revisão, Local, atributos vistos, código e revisão do staging, características e motivo. O comando exige a proteção de características existentes, trava o levantamento, recusa repetição de linha ou Grupo e reusa o comando individual motivado, inclusive suas guardas de código e permissão. A operação inteira é revertida se um item falhar; pedido externo idempotente guarda recibos individuais. A confirmação de lote não dispara Auvo.

## Limites

Não seleciona cadastros automaticamente nem aprova linhas pelo usuário. Dados adicionais não suportados continuam recusados pelo comando individual. Antes de habilitar, validar autorização e revogação, sequência de gates, concorrência, revisões, ordem de travas, rollback, replay, códigos atuais/históricos, limites e integração real com o lote, além de revisão adversarial. Não aplicar a produção nesta etapa.
