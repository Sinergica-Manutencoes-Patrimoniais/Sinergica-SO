---
name: "docs-adr-1371-snapshot-servico-mediado-md"
description: "Documento Sinérgica SO: ADR-1371 — Fotografia mediada de serviço extra"
alwaysApply: false
---

# ADR-1371 — Fotografia mediada de serviço extra

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Expor consulta da fotografia existente e comando mediado para registrar a fotografia da decisão aceita de uma declaração do mesmo Cliente. A leitura usa gate mediado existente; a escrita exige gate próprio desligado, capacidade financeira, trava de autorização e os gates do núcleo. A decisão é identificada no servidor a partir da declaração e não fornecida livremente pelo cliente. Repetição usa o mesmo request; identificação da fotografia e decisão é validada antes de retornar. A tela recupera pedidos com resposta perdida e não substitui fotografia já registrada.

## Limites

A fotografia registra dados aprovados, não comprova execução física ou exclusividade e não gera faturável. Antes de ativar, testar autorização/revogação, concorrência, idempotência, sessão, alteração de proposta, Cliente, ACL/RLS/FORCE e revisão adversarial.
