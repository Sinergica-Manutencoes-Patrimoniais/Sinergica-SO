# ADR-0139 — Interface de cronograma sobre staging unificado

**Status:** proposta, não aplicada nem homologada.

## Decisão

Preparar consultas e anotação específicas de cronograma sobre o staging E01-S178, com permissão `plano.gerir`, revisão otimista e comandos idempotentes no registro compartilhado. As linhas de cronograma usam tipo próprio; consultas não misturam lotes de cadastro. Adaptar interface aos novos nomes de RPC. Todas as funções novas permanecem sem concessão e dependem do gate fechado da ADR-0136.

## Limites

Esta conexão não aprova nem incorpora Plano ou Rotina. Acesso de cadastro às consultas genéricas do staging, colisões no namespace de origem, migração de dados 0347, testes de concorrência, revisão adversarial e homologação continuam pendentes. Não habilitar até resolver isolamento entre capacidades e coexistência com leitores genéricos.
