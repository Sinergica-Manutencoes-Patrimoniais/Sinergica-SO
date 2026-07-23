---
name: spec-E09-S02-portal-painel-condominio
description: Contrato — home do Portal do Cliente: painel read-only do condomínio (SLA/status, próximas visitas, chamados abertos, últimos documentos), reusando o read-model da Visão 360.
alwaysApply: true
tier: pequeno
---

# Spec — Painel do condomínio (home do portal)

> **Fonte da verdade.** Status: aprovado. Depende de E09-S01 (fundação/isolamento).

## Resumo
A tela inicial do Portal do Cliente é um **painel read-only do condomínio do síndico**: indicadores
operacionais (SLA/status), próximas visitas, chamados em aberto e últimos documentos — tudo escopado
ao `cliente_id` do síndico pela RLS de E09-S01. **Nunca** expõe custo/rentabilidade.

## Contexto atual (AS-IS)
- Read-model por cliente pronto e read-only: `application/obter-visao-cliente.ts`,
  `cliente-360-gateway.ts` (métricas osAbertas/backlogTotal/slaPercentual/equipamentosAtivos, backlog,
  histórico, eventos). Reusar via a fronteira, escopado pela RLS por-linha.

## Critérios de aceite

### AC-1: Painel escopado ao condomínio do síndico
- **Dado** um síndico logado na PortalShell (E09-S01)
- **Quando** abre o painel
- **Então** vê os indicadores e listas **apenas do seu condomínio** (RLS por `cliente_id`), sem
  qualquer seletor de outro cliente.

### AC-2: Indicadores operacionais (sem dado interno)
- **Dado** o painel
- **Quando** renderiza
- **Então** mostra SLA/status operacional, OS abertas, próximas visitas (PMOC), chamados em aberto e
  atalhos aos últimos documentos — **nunca** custo, margem ou rentabilidade (regra do blueprint 09).

### AC-3: Read-only
- **Dado** o painel
- **Quando** o síndico interage
- **Então** só navega/consulta; nenhuma mutação nasce aqui (aberturas/interações são S03..S09).

### AC-4: Estado vazio
- **Dado** condomínio sem dados numa seção
- **Quando** o painel renderiza
- **Então** cada card degrada com estado vazio claro, sem derrubar o painel.

## Fora de escopo (vinculante)
- Qualquer escrita (chamado/nota/aprovação) — outras stories.
- Custo/rentabilidade/qualquer dado interno.

## Rastreabilidade
- Nova feature `apps/web/src/features/area-cliente/` (páginas do portal, PortalShell de E09-S01)
- Reusa read-model: `obter-visao-cliente.ts`, `cliente-360-gateway.ts` (via fronteira, RLS-escopado)
- Depende de E09-S01 (claim `cliente_id`, RLS, shell)
