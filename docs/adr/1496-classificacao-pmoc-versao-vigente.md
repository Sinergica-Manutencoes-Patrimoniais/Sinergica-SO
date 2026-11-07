---
name: "docs-adr-1496-classificacao-pmoc-versao-vigente-md"
description: "Documento Sinérgica SO: ADR-1496 — Conferência PMOC após aprovação"
alwaysApply: false
---

# ADR-1496 — Conferência PMOC após aprovação

Um agendamento PMOC pode surgir ou mudar depois da aprovação, e a geração não deve depender de reabrir a versão apenas para classificá-lo para o Plano. Preparar classificação auditada, idempotente e vinculada à versão aprovada vigente na data do ciclo. O PCM informa evidência e motivo; o servidor confirma sessão, permissões, revisão, ciclo, fotografia e ausência de vínculo válido quando não relacionado; para relacionado exige vínculo válido na versão. A classificação é reutilizada pelo inventário existente sem modificar Plano, agendamento ou OS. O vínculo relacionado deve ser criado no fluxo próprio e validado antes da classificação. Falhas incertas preservam o pedido de repetição.

Gates continuam desligados; a declaração humana não valida fonte externa. Antes de habilitar, testar acessos, revogações, concorrência, versões com vigência, fotografia obsoleta, duplicidades e comportamento da interface. Sem deploy ou Auvo.
