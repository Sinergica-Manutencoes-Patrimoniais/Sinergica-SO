---
name: "docs-adr-1424-mediacao-decisao-retorno-md"
description: "Documento Sinérgica SO: ADR-1424 — Decisão de devolução ou reabertura mediada"
alwaysApply: false
---

# ADR-1424 — Decisão de devolução ou reabertura mediada

E01-S168: a tela usa uma entrada autenticada com gate próprio para devolver ou reabrir um retorno, preservando a função versionada privada, a revisão, a auditoria e a idempotência existentes. Aprovação permanece exclusiva do fluxo de atestação e encerramento. A consulta usa a mediação de histórico já existente. Gates são fechados por padrão; nenhuma alteração reabre ou encerra a OS automaticamente.

Antes de ativar: validar concorrência, reclassificação, revogação de permissão, reabertura de OS já finalizada, transições do retorno, RLS e revisão adversarial. Não interpretar uma decisão como evidência de execução.
