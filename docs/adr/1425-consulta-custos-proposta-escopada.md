---
name: "docs-adr-1425-consulta-custos-proposta-escopada-md"
description: "Documento Sinérgica SO: ADR-1425 — Consulta de custos por Cliente e proposta"
alwaysApply: false
---

# ADR-1425 — Consulta de custos por Cliente e proposta

E01-S170/S184: acrescentar consulta interna limitada aos totais atuais de uma proposta, apenas para ator com concessão `custo.ler` no Cliente ligado à oportunidade. A consulta verifica vínculo e autorização no servidor, com controle próprio fechado, sem alterar as policies restritivas existentes nem expor snapshots, fornecedores ou composição histórica. Cliente do Portal continua excluído pela autorização existente.

Esta consulta não substitui o editor Comercial nem autoriza alteração de preço ou emissão. Antes de ativar: testar acesso cruzado, revogação concorrente, Cliente inativo, vínculos operacionais divergentes, RLS/FORCE, histórico e revisão adversarial.
