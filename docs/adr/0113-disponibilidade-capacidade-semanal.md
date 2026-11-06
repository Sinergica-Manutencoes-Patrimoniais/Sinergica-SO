---
name: "docs-adr-0113-disponibilidade-capacidade-semanal-md"
description: "Documento Sinérgica SO: ADR-0113 — Disponibilidade declarada por técnico e semana"
alwaysApply: false
---

# ADR-0113 — Disponibilidade declarada por técnico e semana

## Estado

Proposta não homologada; migration 0334 e interface desligada não foram aplicadas ou testadas.

## Decisão

Registrar por Cliente, funcionário e semana civil segunda–domingo os minutos explicitamente destinados à operação, reservas e ausências declaradas como não sobrepostas. Dados faltantes não são zero. Comando requer capacidade própria, revisão, requestId e confirmação explícita da ausência de sobreposição; guarda autor e antes/depois na auditoria. Agenda legada não contém duração nem representa disponibilidade e não é convertida automaticamente.

## Limites e gates

Confirmação humana não prova que intervalos não se sobrepõem; faltam fontes temporais canônicas e detecção automática. Consulta adicional expõe vínculos vigentes de equipe/Visita por semana no fuso da Visita, sem somá-los como demanda consolidada nem saldo. Ocorrências/OS, terceiros, deslocamento, qualificações, concorrência, revogação, deduplicação e alertas ainda não foram integrados. Revisar permissão, RLS, audit, concorrência, fuso e transações com db-tests antes de habilitar; não declarar capacidade validada.
