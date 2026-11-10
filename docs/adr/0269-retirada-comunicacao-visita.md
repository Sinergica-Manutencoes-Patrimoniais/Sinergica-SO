---
name: "docs-adr-0269-retirada-comunicacao-visita-md"
description: "Documento Sinérgica SO: ADR-0269 — Retirada de comunicação da visita"
alwaysApply: false
---

# ADR-0269 — Retirada de comunicação da visita

Status: proposta; migrations ainda não aplicadas, gates fechados.

O PCM pode retirar publicação mediante motivo auditado. Leitura no Portal, calendário e registro de ciência passam a excluir comunicações retiradas. A retirada serializa com ciência pelo bloqueio da publicação, e o histórico de ciências permanece preservado. A ADR-0271 permite nova publicação na mesma revisão sem restaurar a anterior. Histórico interno é limitado à Visita e Conta autorizadas. Sem envio externo; antes de ativar são necessários testes de isolamento, concorrência e migrações.
