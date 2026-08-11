---
name: ADR-0021
description: Read model paginado para o board unificado de Chamados/OS.
alwaysApply: false
---

# ADR-0021 — Read model paginado para Operação

> **Status:** aceito · **Data:** 2026-08-10 · **Decisores:** @architect, @dev

## Contexto
O board unifica `pcm.chamados` e `pcm.ordens_servico`, mas monta essa projeção no browser após
baixar todas as OS, clientes, funcionários e detalhes. A mesma estrutura serve cinco visões com
necessidades diferentes, criando overfetch, DOM grande e refetch global.

## Decisão
Adotar CQRS leve: comandos continuam nos gateways atuais; leitura do board usa view
`pcm.operacao_itens` com `security_invoker`, projeção mínima e paginação keyset. Cache e
cancelamento ficam padronizados por TanStack Query. Detalhes pesados são carregados sob demanda.

## Consequências
- Positivas: payload limitado, RLS central preservada, cursores estáveis, views independentes,
  cache/deduplicação e rollback do frontend sem rollback de banco.
- Negativas: read model adicional, mais de uma query pequena no Kanban e invalidação de cache após
  comandos.
- Neutras: não muda domínio, tabelas canônicas nem fluxo de escrita.

## Alternativas rejeitadas
- RPC JSON monolítica: contrato opaco e muitas ordenações condicionais.
- Manter full-fetch e virtualizar: reduz DOM, não rede/memória.
- Cache próprio: duplica comportamento consolidado de TanStack Query.

## Reversão
Redeploy do frontend anterior. Migration é aditiva; view, funções e índices podem ser removidos em
migration posterior somente após confirmar ausência de consumidores.
