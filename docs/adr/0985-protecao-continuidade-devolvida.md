---
name: "docs-adr-0985-protecao-continuidade-devolvida-md"
description: "Documento Sinérgica SO: ADR-0985 — Proteção da continuidade já devolvida"
alwaysApply: false
---

# ADR-0985 — Proteção da continuidade já devolvida

Status: preparação privada, não homologada.

Após criação de retorno parcial, a proposta de continuidade continua pendente no modelo antigo. Preparar guarda no banco que recusa sua alteração ou exclusão enquanto houver retorno parcial referenciando-a, independentemente do gate da interface. O comando legado que cria uma OS de continuidade altera a proposta na mesma transação; a guarda deve provocar rollback dessa transação, sem presumir que impeça escritores que criem OS por outro caminho ou tarefas externas já existentes. O comando de retorno toma lock da proposta antes de gravar o retorno; validar as duas ordens de concorrência.

A guarda não muda a proposta para rejeitada, executada ou outro estado e pode impedir o encerramento do Chamado antigo enquanto a proposta permanecer pendente. Projetar transição auditada de transferência e adaptar consumidores/avaliação de encerramento antes de ativar. Verificar triggers, writers, transação da outbox, RLS/FORCE, locks, dados legados, rollback e revisão adversarial. A migration não foi aplicada; não abrir gates, implantar ou disparar tarefas.
