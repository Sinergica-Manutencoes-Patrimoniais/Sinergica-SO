---
name: "docs-adr-0729-proteger-planos-vinculados-e-autoria-md"
description: "Documento Sinérgica SO: ADR-0729 — Proteger vínculos financeiros e autoria"
alwaysApply: false
---

# ADR-0729 — Proteger vínculos financeiros e autoria

**Status:** incremento em diagnóstico; não homologado nem implantado.

Os testes de 0952 identificaram que Financeiro autorizado ainda pode criar, encerrar ou alterar diretamente planos vinculados ao Comercial sem preservar seu ciclo, e que INSERT direto Comercial pode informar outro autor. A política é global por módulo: o problema é a integridade do vínculo, não uma nova restrição por Cliente.

## Decisão

O Financeiro mantém suas operações diretas e RPCs para planos próprios sem `comercial_contrato_id`. Para planos vinculados, a escrita de ciclo e a associação ficam reservadas à mediação transacional da ADR-0727: RLS nega INSERT, UPDATE e DELETE diretos autenticados quando houver vínculo, bem como a introdução de vínculo por UPDATE. As RPCs financeiras públicas rejeitam criação com vínculo e encerramento de plano vinculado; as funções internas não concedidas continuam a ser usadas pelo comando Comercial e travam o contrato para serialização.

INSERT direto em contrato Comercial deve identificar `created_by` como o usuário atual e não pode definir manualmente timestamps; permissões por coluna preservam os campos necessários à criação e ao rascunho. A mediação não deve aceitar autoria informada pelo usuário. O histórico e vínculos existentes não serão apagados ou retificados automaticamente.

## Limites e compatibilidade

Estas restrições afetam consumidores que escrevem diretamente em planos vinculados, inclusive potenciais integrações fora do repositório. O rollout exige inventário desses consumidores, revisão de permissões efetivas e teste de caminho legítimo Financeiro sem vínculo. Service role e proprietários privilegiados não são confinados por RLS; suas fronteiras e controles continuam pendentes. Uma existência anterior de planos duplicados/inconsistentes não é reparada e exige inventário próprio antes de ativar. Nenhuma cobrança ou integração externa é disparada pela migration.

Testar sinteticamente bloqueios e caminho legítimo, preservação do vínculo, ativação/encerramento mediado, permissão atual, concorrência e rollback de falhas em banco isolado. Reversão operacional é desativar consumidores e empregar migration compensatória revisada sem apagar planos, vínculos ou histórico; reabrir escrita direta seria regressão de segurança. CI/db-tests e revisão adversarial são obrigatórios antes de homologação.
