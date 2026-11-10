---
name: "docs-adr-1283-cancelamento-provisorio-com-os-md"
description: "Documento Sinérgica SO: ADR-1283 — Cancelamento de contêiner provisório com OS preservada"
alwaysApply: false
---

# ADR-1283 — Cancelamento de contêiner provisório com OS preservada

Status: proposta local; não aplicada nem homologada.

Preparar cancelamento auditado do Chamado provisório sem destino, preservando o vínculo histórico e a OS existente. O comando confere Cliente, identidade da tarefa, revisão e fotografia, exige motivo e permissões, e registra exceção imutável vinculada exatamente à OS. Não cancela a tarefa ou execução. Origem com outras OS ou escopo estruturado exige reconciliação e permanece bloqueada.

A guarda comum de Chamado cancelado é adaptada apenas para permitir mudanças de status da OS já vinculada, quando existir a exceção e gate próprio habilitado. Ela continua recusando troca de identidade, vínculo, Cliente, exclusão e cancelamento da OS por essa exceção. Outras guardas continuam aplicáveis. Revisar integralmente os consumidores legados e efeitos indiretos de alteração de status: a exceção isolada não prova que a execução poderá prosseguir nem que não haverá notificação ou efeito remoto.

Os dois gates nascem fechados. Antes de habilitar, validar concorrência, todas as ordens de locks, histórico, triggers, reabertura, permissões/RLS/FORCE, uso indevido da exceção, rollback e revisão adversarial. A operação não executa tarefa Auvo.
