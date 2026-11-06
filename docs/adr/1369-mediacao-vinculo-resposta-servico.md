---
name: "docs-adr-1369-mediacao-vinculo-resposta-servico-md"
description: "Documento Sinérgica SO: ADR-1369 — Acesso mediado ao vínculo de resposta de serviço"
alwaysApply: false
---

# ADR-1369 — Acesso mediado ao vínculo de resposta de serviço

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Adicionar entradas mediadas para listar declarações de serviço, consultar opções de evidência e declarar seu vínculo com a linha. As leituras usam o gate do ADR-1366; o vínculo usa gate de escrita independente, inicialmente fechado. Permissões exigidas pelos núcleos privados são mantidas, com trava de autorização e rechecagem após a escrita; nenhum núcleo recebe EXECUTE público. O vínculo é uma declaração auditada, não prova execução nem gera faturável.

## Limites

Antes de ativar, validar contratos, gates dos núcleos, autorização, revogação, locks, isolamento, idempotência, resposta perdida, concorrência e revisão adversarial. Não altera proposta, cobrança ou tarefa Auvo.
