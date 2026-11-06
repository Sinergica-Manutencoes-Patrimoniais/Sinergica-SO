---
name: "docs-adr-1372-reconciliacao-servico-material-mediada-md"
description: "Documento Sinérgica SO: ADR-1372 — Reconciliação mediada de serviço e material"
alwaysApply: false
---

# ADR-1372 — Reconciliação mediada de serviço e material

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Preparar acessos mediados para materiais da OS, histórico e diagnóstico da reconciliação e decisão versionada. A lista de materiais é filtrada no servidor por Cliente e OS, sem retornar texto de evidência. Leituras usam gate mediado existente; decisão exige gate independente desligado. Todas exigem capacidades Financeiro e validação, trava de autorização e gates dos núcleos, que permanecem privados. A decisão é declarativa e não autoriza faturamento.

## Limites

Não comprova exclusividade nem execução e não cria faturável. Validar ACL/RLS/FORCE, Cliente/OS, paginação, revogação, concorrência, lock dos gates de origem, replay e revisão adversarial antes da ativação.
