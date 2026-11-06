---
name: adr-1677-ativacao-contrato-sem-custos
description: Ativação comercial preserva transição da oportunidade sem expor custos.
alwaysApply: false
---

# ADR-1677 — Ativação de contrato sem acesso a custos

## Estado

Proposta pendente de revisão e ensaio isolado; não autoriza implantação.

## Decisão

A função histórica de ativação consulta a tabela de propostas sujeita à política de custos e pode ignorar a oportunidade para um operador Comercial. A migration aditiva conserva SECURITY INVOKER, assinatura e ACL, exige escrita Comercial atual e consulta a view existente sem custos. Antes de efeitos, verifica a oportunidade acessível e o Cliente do contrato; ausência ou divergência aborta a transação. As consultas de transição passam a usar a mesma view. Se a etapa ganha não existir ou a atualização for filtrada, a transação também falha; a tabela de custos e suas políticas não são alteradas.

## Limites e validação

Validar em clone a transição para ganha, atomicidade, custo oculto, permissão revogada, papel divergente, oportunidade ausente e ACL. O protocolo histórico não serializa alterações de proposta ou revogações concorrentes; esta decisão não afirma solucionar essa corrida. A migration falha fechada se a definição efetiva divergir.
