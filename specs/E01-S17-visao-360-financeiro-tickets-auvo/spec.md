---
name: spec-E01-S17-visao-360-financeiro-tickets-auvo
description: Investigação/contrato da fase 2 Financeiro/Tickets/Orçamentos Auvo na Visão 360.
alwaysApply: false
---

# Spec — E01-S17 Painel Financeiro/Tickets/Orçamentos Auvo na Visão 360

> Status: bloqueada por contrato externo não confirmado (2026-07-04).
> Resultado da investigação: há evidência pública de produto Auvo para Financeiro, Central/Tickets
> e Orçamentos, mas não foi encontrado endpoint público confirmado na API v2 para leitura desses
> dados por cliente. Sem endpoint confirmado, não implementar painel nem schema.

## Resumo
A Visão 360 deve ganhar uma fase 2 com financeiro/tickets/orçamentos do cliente somente se existir
endpoint Auvo equivalente, read-only, consultável por `auvo_customer_id`.

## Critérios de aceite

### AC-1: Não inventar endpoint nem dado financeiro
- **Dado** que não há endpoint confirmado
- **Quando** a story é avaliada
- **Então** nenhum painel, tabela ou adapter de dados financeiros/tickets/orçamentos é implementado.

### AC-2: Registrar bloqueio e fonte da incerteza
- **Dado** a investigação feita em 2026-07-04
- **Quando** o roadmap/estado são atualizados
- **Então** a story fica marcada como bloqueada/aguardando contrato Auvo ou payload real.

## Fora de escopo enquanto bloqueada
- Criar tabelas locais financeiras.
- Exibir cards vazios que sugiram dado real.
- Consultar endpoints por tentativa em produção.

## Rastreabilidade
- Previsto como fase 2 em `../E01-S12-visao-360-cliente/product.md` §4.
- Evidência pública de produto: páginas Auvo de integrações/Central indicam módulos de Financeiro,
  Tickets/Central e Orçamentos, mas não documentam endpoint API read-only por cliente.
