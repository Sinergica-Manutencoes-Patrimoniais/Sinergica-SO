---
name: "docs-adr-1088-varredura-os-local-md"
description: "Documento Sinérgica SO: ADR-1088 — Varredura local de OS para reconciliação"
alwaysApply: false
---

# ADR-1088 — Varredura local de OS para reconciliação

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar varredura paginada e idempotente das OS com indicação local de sincronização ou identificador Auvo, reaproveitando as ocorrências e eventos da ADR-1085. Eventos distinguem operador e varredura; a página mantém recibo por requestId e cursor. A varredura não consulta Auvo, não reenvia, não confirma efeito remoto nem resolve automaticamente o alerta. Não há agendamento nesta migration.

## Limites

A varredura por UUID não representa fotografia de toda a base: novas OS atrás do cursor só aparecem na próxima varredura completa. Mudanças de Cliente e dados inconsistentes exigem tratamento auditado. Antes da ativação, implementar executor e recuperação de páginas, provar isolamento/RLS, concorrência com operador e transições, cadência, leases, autenticação de serviço e revisão adversarial. Gate fechado e execução privada; não agendar nem implantar automaticamente.
