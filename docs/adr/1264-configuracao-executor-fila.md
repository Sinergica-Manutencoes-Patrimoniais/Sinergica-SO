---
name: "docs-adr-1264-configuracao-executor-fila-md"
description: "Documento Sinérgica SO: ADR-1264 — Configuração auditada do executor de fila"
alwaysApply: false
---

# ADR-1264 — Configuração auditada do executor de fila

**Status:** proposta local, não homologada.

Preparar configuração de habilitação e intervalo do executor interno exclusivamente por superadministrador ativo, com revisão otimista, motivo, idempotência e auditoria. A alteração de configuração não cria cron nem envia tarefa ao Auvo; caso um agendador já exista em implantação futura, habilitar poderá permitir execuções posteriores. A escrita compartilha a trava do executor e usa gate administrativo novo fechado.

Antes de abrir gate ou implantar, validar todos os escritores, concorrência com executor, resultado perdido, autorização/revogação, rollback, RLS/FORCE e revisão adversarial. Não alterar configuração ou criar agendamento real nesta etapa.
