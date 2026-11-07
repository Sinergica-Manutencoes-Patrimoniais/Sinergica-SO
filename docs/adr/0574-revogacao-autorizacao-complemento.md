---
name: "docs-adr-0574-revogacao-autorizacao-complemento-md"
description: "Documento Sinérgica SO: ADR-0574 — revogação de autorização de complemento"
alwaysApply: false
---

# ADR-0574 — revogação de autorização de complemento

Status: proposto; gates fechados, não aplicado nem homologado. Uma autorização interna pode ser revogada com motivo, identidade idempotente e revisão esperada apenas enquanto o complemento está pendente e sem histórico de alocação ou reserva ativa. A revogação é imutável, não altera valor, item, documento, cobrança ou fatos faturados. A conferência revalida a ausência de revogação sob lock da autorização; comandos concluídos preservam retry idempotente.

A revogação não cancela aceite do Cliente nem regulariza item já conferido/faturado. A proposta 0804 permite uma nova autorização para a mesma revisão sem restaurar a anterior; permanece fechada e sem homologação. Ordem de locks, concorrência, autorização e testes financeiros adversariais são obrigatórios antes de ativação.
