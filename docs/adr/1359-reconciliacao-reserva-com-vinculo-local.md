---
name: "docs-adr-1359-reconciliacao-reserva-com-vinculo-local-md"
description: "Documento Sinérgica SO: ADR 1359 — Reconciliação de reserva com tarefa já vinculada à OS"
alwaysApply: false
---

# ADR 1359 — Reconciliação de reserva com tarefa já vinculada à OS

## Contexto

Se o envio legado vinculou a tarefa à OS mas perdeu a resposta antes de confirmar a reserva, a reserva permanece pendente. A confirmação automática atual é restrita ao serviço.

## Decisão

Permitir que pessoa com permissão de reconciliação confirme a mesma reserva somente quando a OS do mesmo Cliente já possui exatamente o ID de tarefa informado. A transição reutiliza a trava da OS, exige motivo e request idempotente e registra auditoria. Não cria, altera ou consulta tarefa Auvo; não confirma ausência de efeito para reservas sem vínculo local. ID da tarefa é fornecido como texto numérico limitado à precisão segura.

## Consequências

O vínculo local não comprova existência, identidade ou estado remoto. Não liberar nova tentativa de envio com base nessa consulta. Gate separado fechado; validar autenticação, locks, corrida com o serviço, histórico, RLS/FORCE, revogação, replay e revisão adversarial antes de habilitar.
