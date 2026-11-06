---
name: "docs-adr-0713-observacoes-ativos-conferidas-md"
description: "Documento Sinérgica SO: ADR-0713 — Observações comprovadas na incorporação de ativos"
alwaysApply: false
---

# ADR-0713 — Observações comprovadas na incorporação de ativos

A guarda da ADR-0712 admite `observacoes` preenchidas apenas para Equipamento ou Componente quando o registro oficial da mesma entidade e Cliente já contém exatamente o texto informado em staging dentro da transação. Os demais atributos não suportados continuam bloqueados. A comprovação é baseada no efeito efetivo, não no nome do comando; criação que não grava observações continua recusada.

A comparação exata é deliberadamente conservadora: texto normalizado ou com espaços alterados não é considerado preservado. Falhas revertem toda a transação e não apagam staging ou histórico. Gate e demais validações permanecem; testes de concorrência, replay e isolamento são necessários antes da ativação.
