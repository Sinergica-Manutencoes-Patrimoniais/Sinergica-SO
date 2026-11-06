---
name: adr-1676-criacao-contrato-sem-custos
description: Criação de contrato comercial usando projeção sem custos e autorização atual.
alwaysApply: false
---

# ADR-1676 — Criação de contrato sem acesso a custos

## Estado

Proposta pendente de revisão e ensaio isolado; não autoriza implantação.

## Decisão

A política 0235 restringe a leitura direta de propostas com custos a superadministrador, enquanto a função invocadora de criação de contrato consultava essa tabela. A migration aditiva substitui somente essa leitura pela view existente `propostas_sem_custos` e exige autorização comercial de escrita atual, além da guarda original. A função continua SECURITY INVOKER e preserva assinatura, ACL e políticas de escrita. Proposta sem oportunidade é recusada; nenhum Cliente é inferido. O escopo comercial existente permanece aplicável.

## Limites e validação

O protocolo legado não trava a proposta durante a leitura; esta alteração não afirma corrigir concorrência com edição ou revogação. Antes de aplicar, validar usuário ativo com escrita atual, leitura direta de custos negada, revogação, proposta ausente ou sem oportunidade, duplicidade, RLS e preservação da resposta. Não afrouxar políticas de custos. A migration exige definição exata e aborta se ela divergir.
