---
name: "docs-adr-0800-e01-s180-dispatch-experimental-md"
description: "Documento Sinérgica SO: ADR-0800 — Dispatcher experimental para políticas de upload S180"
alwaysApply: false
---

# ADR-0800 — Dispatcher experimental para políticas de upload S180

Status: experimental; não autorizado para rollout ou homologação.

## Contexto

Políticas de INSERT de seis buckets compartilham `storage.objects` e referenciam helpers cujo EXECUTE foi revogado. A avaliação de ACL pode falhar para buckets não relacionados, inclusive uploads legados. Alterar apenas a política S180 não resolve esse conflito. O dispatcher isolado, sem guarda global, também pode liberar uploads legados antes negados.

## Decisão

A migration 0996 prepara duas funções internas revogadas: dispatcher explícito por bucket e guarda global conservadora. Nenhuma policy, grant existente ou gate é alterado. As funções não são endpoints e não podem ser invocadas por `authenticated`. A guarda deixa o bucket S180 sob responsabilidade de suas próprias políticas; nos demais, exige as seis ACLs dos helpers existentes. A validação de identidade, caminho, cliente e gate continua nos helpers canônicos.

## Evidências e limites

Experimento em transação revertida cobriu negação de buckets com ACL revogada, S180 positivo com ACL parcial e gate habilitado, e S184 positivo/negativo. Experimento em cluster independente sem acesso externo comprovou, para uma ordem específica, que INSERT mantém locks que impedem desativação do usuário e fechamento do gate; após desativação confirmada, novo INSERT foi negado. Isso não prova toda a matriz de permissões, planos SQL ou integridade/imutabilidade dos bytes no Storage.

## Ativação futura

Antes de qualquer rollout, comparar decisões e erros reais de todas as políticas e roles, incluindo ACLs parciais, gates, S184, usuários inativos e concorrência nas duas ordens; validar Storage real e prova de bytes imutáveis. Projetar migration transacional coordenada que substitua as doze políticas e instale a restritiva global atomicamente, com grants mínimos e rollback testado. A mudança não deve promover uploads legados antes negados sem decisão explícita. O gate segue desligado até revisão adversarial e homologação. Este ADR não autoriza ativação, deploy nem serviços externos.
