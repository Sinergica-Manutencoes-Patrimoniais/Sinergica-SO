---
name: "docs-adr-1388-intencao-grupo-mediada-md"
description: "Documento Sinérgica SO: ADR-1388 — Intenção de OS para Grupo mediada"
alwaysApply: false
---

# ADR-1388 — Intenção de OS para Grupo mediada

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Preparar entradas mediadas para consultar intenção, registrar intenção e decidir associação de OS existente. Leitura e escrita usam gates separados, inicialmente desligados, com capacidades de gestão e validação, trava de autorização e gates dos núcleos. Decisão confirma que intenção e ocorrência pertencem ao contexto informado; a guarda de supressão aplica-se também à decisão. Os núcleos permanecem privados e preservam auditoria e idempotência.

## Limites

Intenção e decisão não criam OS, vínculo ou tarefa e não provam execução. Validar Cliente, supressão, concorrência, replay, direitos, sessão, RLS/FORCE e revisão adversarial antes de habilitar.
