---
name: product
description: PRD-lite do registro de comissão (exemplo de referência das camadas com I/O).
alwaysApply: false
---

# Product — Registro de comissão

> **Tier:** pequeno · **Status:** aprovado · **Dono:** <PM>
> Responde: **por quê** e **para quem**.

## Problema
O cálculo de comissão (feature 0001) é puro e não deixa rastro. Para o fechamento e a auditoria,
precisamos **persistir** a comissão de cada venda, sem duplicar quando a mesma venda for
processada mais de uma vez (reprocessamento, retry de webhook).

## Para quem
Fechamento financeiro (consulta/auditoria) e as integrações que disparam o cálculo por venda.

## Resultado esperado / métrica de sucesso
- Métrica: comissões duplicadas no fechamento.
- Alvo: zero duplicação (idempotência por venda).

## Goals
- Persistir a comissão calculada com chave de negócio (vendaId) idempotente.
- Servir de **exemplo de referência das camadas com I/O**: porta no domínio, adapters
  (in-memory e Supabase), caso de uso, borda HTTP e teste de integração.

## Non-goals
- UI de consulta, relatório de fechamento, estorno/ajuste de comissão.
- Recalcular comissões já registradas quando a tabela muda (ver "Fora de escopo" na spec).

## Riscos / premissas
- Premissa: o cálculo (0001) e a tabela vigente são fornecidos; aqui só calcula+persiste.
