---
name: "docs-adr-1383-semana-programada-ocorrencia-visita-md"
description: "Documento Sinérgica SO: ADR-1383 — Semana de referência da ocorrência por Visita"
alwaysApply: false
---

# ADR-1383 — Semana de referência da ocorrência por Visita

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Adicionar consulta versionada de ocorrências sem OS para capacidade: ocorrências por calendário usam vencimento original; ocorrências por Visita usam a data local programada da Visita, mantendo o vencimento original em coluna separada. Visita cancelada usa vencimento como referência para conferência, exceto supressão por feriado, que permanece excluída antes da paginação. A consulta conserva Cliente, autorização, ordenação e esforço declarado; não prova demanda integral nem execução.

A consulta antiga permanece disponível para compatibilidade. A tela nova usa a versão adicional sob flag desligada; o snapshot agregado antigo ainda não usa a nova fonte e não deve ser considerado saldo operacional.

## Limites

Validar fusos, mudança de semana/ano, cancelamento, regras de supressão, alterações concorrentes entre páginas, vínculos de OS, ACL/RLS/FORCE e revisão adversarial. Não altera Visita, ocorrência, vencimento ou tarefa Auvo.
