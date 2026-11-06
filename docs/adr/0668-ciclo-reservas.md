---
name: "docs-adr-0668-ciclo-reservas-md"
description: "Documento Sinérgica SO: ADR-0668 — Ciclo de reservas e aprovação integral"
alwaysApply: false
---

# ADR-0668 — Ciclo de reservas e aprovação integral

Status: proposta; gates fechados, não homologada.

A aprovação integral reserva os códigos ainda não oficiais das linhas conferidas, reutilizando reservas parciais do mesmo ciclo. A rejeição de linha libera sua reserva não consumida; a reabertura libera reservas não consumidas do ciclo anterior. Eventos preservam ator, motivo e histórico. Reserva consumida não é liberada ou reciclada; o código oficial e aliases continuam protegidos. A aprovação e a liberação usam o lock de código e falham em concorrência, nunca inferindo namespace de Grupo.

As alterações 0892/0893 ainda não foram aplicadas e devem ser instaladas juntas com gates desligados. Conferir todas as rotas de reabertura, rejeição, aprovação, retry, ordem de locks e rollback sob testes concorrentes; revisar contratos antes de habilitar e não disparar sincronização externa nesta etapa.
