---
name: "docs-adr-1002-avaliacao-equipment-no-outbox-md"
description: "Documento Sinérgica SO: ADR-1002 — Avaliação de Equipment no outbox"
alwaysApply: false
---

# ADR-1002 — Avaliação de Equipment no outbox

Status: preparação fechada, não homologada.

Preparar consulta interna que decide representação para um Componente com base no vínculo explícito e política vigente. Categoria ausente, texto alterado, Cliente divergente ou política ausente resultam em decisão indeterminada. Vínculo remoto é preservado mesmo quando a categoria passa a ser somente SSO; não executar PATCH, DELETE ou POST para essa linha enquanto exigir reconciliação. Não marcar como enviada uma decisão bloqueada.

O worker somente consulta essa decisão quando uma flag própria estiver habilitada; gate permanece fechado e o rollout não é autorizado por esta preparação. A consulta anterior a uma chamada HTTP não serializa alterações concorrentes durante a chamada: integrar protocolo transacional de reserva/fencing e reconciliar itens já reivindicados antes de ativar. Avaliar eventos de exclusão, os dois IDs Auvo, estado de retry, contrato real e outros caminhos que escrevem Equipment; executar testes e revisão adversarial. Não cria tarefa nem altera dados remotos nesta etapa.
