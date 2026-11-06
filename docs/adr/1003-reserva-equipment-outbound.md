---
name: "docs-adr-1003-reserva-equipment-outbound-md"
description: "Documento Sinérgica SO: ADR-1003 — Reserva durável para Equipment outbound"
alwaysApply: false
---

# ADR-1003 — Reserva durável para Equipment outbound

Status: preparação privada, não homologada.

Preparar reserva persistente por Componente e item da outbox antes de chamada externa, sem expiração automática. Após resultado incerto, a reserva permanece para reconciliação; uma segunda tentativa não deve inferir que a primeira não teve efeito. Uma trava de coordenação deve serializar criação de reserva e alterações de política, vínculo de categoria e classificação do Componente. Não manter transação PostgreSQL aberta durante HTTP.

Esta fundação não autentica resposta Auvo, não estabelece confirmação do efeito remoto e não autoriza repetição de POST. O fluxo deve distinguir confirmação segura, ausência comprovada e resultado incerto; liberação exige mecanismo auditado e validação de todos os escritores, inclusive IDs Auvo, exclusão e filas legadas. Não conceder execução nem ligar worker até concluir integração, revisão adversarial e testes de concorrência. Nenhum envio real nesta etapa.
